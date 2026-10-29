import { createOtpEmail } from './email/otp-email';

import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';

import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';

import * as bcrypt from 'bcrypt';
import * as nodemailer from 'nodemailer';

import { PrismaService } from '../../prisma/prisma.service';

import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { OtpDestinationDto, VerifyOtpDto } from './dto/otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);


  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  // =====================================================
  // USER RELATIONS
  // =====================================================

  private readonly userInclude = {
    tenant: true,

    roles: {
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    },

    companyAccess: {
      include: {
        company: true,
      },
    },

    branchAccess: {
      include: {
        branch: true,
      },
    },
  } as const;

  // =====================================================
  // GET ACTIVE USER
  // =====================================================

  private async getActiveUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: this.userInclude,
    });

    if (
      !user ||
      user.status !== 'ACTIVE' ||
      !user.tenantId ||
      user.tenant?.status !== 'ACTIVE'
    ) {
      throw new UnauthorizedException(
        'Invalid or inactive account',
      );
    }

    return user;
  }

  // =====================================================
  // CREATE USER SESSION
  // =====================================================

  private makeSession(
    user: Awaited<ReturnType<typeof this.getActiveUser>>,
  ) {
    const roles = user.roles.map((r) => r.role.name);
    const primaryRole = [
      'BUSINESS_OWNER',
      'BUSINESS_ADMIN',
      'COMPANY_MANAGER', 'BRANCH_MANAGER',
      'SALES_MANAGER',
      'HR_MANAGER',
      'PAYROLL_MANAGER',
      'EMPLOYEE',
    ].find(role => roles.includes(role)) ?? roles[0] ?? 'EMPLOYEE';

    const permissions = [
      ...new Set(
        user.roles.flatMap((r) =>
          r.role.permissions.map(
            (p) => p.permission.key,
          ),
        ),
      ),
    ];

    const memberships = user.companyAccess
      .filter(
        ({ company }) =>
          company.status === 'ACTIVE' &&
          company.tenantId === user.tenantId,
      )
      .map(({ company }) => ({
        id: `${user.id}:${company.id}`,

        tenantId: user.tenantId!,

        companyId: company.id,

        companyName: company.name,

        role: primaryRole,

        roles,

        permissions,

        branches: user.branchAccess
          .filter(
            ({ branch }) =>
              branch.companyId === company.id &&
              branch.status === 'ACTIVE',
          )
          .map(({ branch }) => ({
            id: branch.id,
            name: branch.name,
          })),
      }));

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },

      memberships,
    };
  }

  // =====================================================
  // BUSINESS SIGNUP
  // =====================================================

  async signup(dto: SignupDto) {
    const businessName = dto.businessName.trim();
    const branchName = dto.branchName.trim();
    const ownerName = dto.ownerName.trim();
    const email = dto.email.trim().toLowerCase();
    const phone = dto.phone.trim();

    if (!businessName || !ownerName) {
      throw new BadRequestException(
        'Business name and owner name are required',
      );
    }

    if (!/^[0-9]{10}$/.test(phone)) {
      throw new BadRequestException(
        'Enter a valid 10-digit mobile number',
      );
    }

    if (
      !dto.password.trim() ||
      dto.password.length < 8 ||
      dto.password.length > 128
    ) {
      throw new BadRequestException(
        'Password must contain 8 to 128 characters',
      );
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      throw new ConflictException(
        'This email address is already registered',
      );
    }

    const emailProof = await this.checkOtp({ challengeId: dto.emailChallengeId, otp: dto.emailOtp }, 'signup', true);
    if (emailProof.channel !== 'email' || emailProof.destination !== email) {
      throw new BadRequestException('Verify the email entered in this form');
    }

    const ownerRole = await this.prisma.role.findUnique({
      where: {
        name: 'BUSINESS_OWNER',
      },
      select: {
        id: true,
      },
    });

    if (!ownerRole) {
      throw new InternalServerErrorException(
        'Business Owner role is not configured. Contact the administrator.',
      );
    }

    const hashedPassword = await bcrypt.hash(
      dto.password,
      12,
    );

    try {
      const registration = await this.prisma.$transaction(
        async (tx) => {
          await this.consumeOtp(tx, emailProof.id);
          // Create tenant
          const tenant = await tx.tenant.create({
            data: {
              name: businessName,
              status: 'ACTIVE',
            },
          });

          // Create company
          const company = await tx.company.create({
            data: {
              tenantId: tenant.id,
              name: businessName,
              status: 'ACTIVE',
            },
          });

          // Create the initial branch using the name entered during signup.
          const branch = await tx.branch.create({
            data: {
              companyId: company.id,
              name: branchName,
              code: `MAIN${randomBytes(6).toString('hex').toUpperCase()}`,
              location: '',
              manager: '',
              status: 'ACTIVE',
            },
          });

          // Create business owner
          const user = await tx.user.create({
            data: {
              tenantId: tenant.id,
              name: ownerName,
              email,
              phone,
              password: hashedPassword,
              status: 'ACTIVE',
            },
          });

          // Assign owner role
          await tx.userRole.create({
            data: {
              userId: user.id,
              roleId: ownerRole.id,
            },
          });

          // Assign company access
          await tx.userCompanyAccess.create({
            data: {
              userId: user.id,
              companyId: company.id,
            },
          });

          // Assign branch access
          await tx.userBranchAccess.create({
            data: {
              userId: user.id,
              branchId: branch.id,
            },
          });

          // Create subscription
          await tx.businessSubscription.create({
            data: {
              tenantId: tenant.id,
              planId: dto.planId,
              billingCycle: dto.billingCycle,
              status: 'PENDING_ACTIVATION',
            },
          });

          return {
            tenantId: tenant.id,
            companyId: company.id,
            branchId: branch.id,
            userId: user.id,
          };
        },
      );

      return {
        message: 'Business account created successfully',

        user: {
          id: registration.userId,
          name: ownerName,
          email,
        },

        business: {
          tenantId: registration.tenantId,
          companyId: registration.companyId,
          branchId: registration.branchId,
          name: businessName,
        },

        subscription: {
          planId: dto.planId,
          billingCycle: dto.billingCycle,
          status: 'PENDING_ACTIVATION',
        },

        nextStep: 'LOGIN',
      };
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'This email address is already registered',
        );
      }

      throw error;
    }
  }

  // =====================================================
  // LOGIN
  // =====================================================

  async login(dto: LoginDto) {
    const account = await this.prisma.user.findUnique({
      where: {
        email: dto.email.trim().toLowerCase(),
      },
    });

    if (!account) {
      throw new UnauthorizedException(
        'Invalid email or password',
      );
    }

    const passwordValid = await bcrypt.compare(
      dto.password,
      account.password,
    );

    if (!passwordValid || account.status !== 'ACTIVE') {
      throw new UnauthorizedException(
        'Invalid email or password',
      );
    }

    const user = await this.getActiveUser(account.id);

    if (
      dto.tenantId &&
      dto.tenantId !== user.tenantId
    ) {
      throw new UnauthorizedException(
        'Invalid email or password',
      );
    }

    const roles = user.roles.map((r) => r.role.name);

    const employeeOnly =
      roles.includes('EMPLOYEE') &&
      !roles.some((r) =>
        [
          'BUSINESS_OWNER',
          'BUSINESS_ADMIN',
          'HR_MANAGER',
          'PAYROLL_MANAGER',
          'COMPANY_MANAGER', 'BRANCH_MANAGER',
          'SALES_MANAGER',
          'MANAGER',
          'SALES',
          'HR',
          'PAYROLL',
        ].includes(r),
      );

    if (
      (dto.portal === 'employee' && !employeeOnly) ||
      (dto.portal === 'staff' && employeeOnly)
    ) {
      throw new UnauthorizedException(
        'This account cannot access the selected portal',
      );
    }

    const session = this.makeSession(user);

    if (
      !session.memberships.some(
        (membership) => membership.branches.length > 0,
      )
    ) {
      throw new UnauthorizedException(
        'No active company or branch access assigned',
      );
    }

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      tenantId: user.tenantId,
      tokenVersion: user.tokenVersion,
    });

    return {
      message: 'Login successful',
      accessToken,
      session,
    };
  }

  // =====================================================
  // CURRENT AUTHENTICATED USER
  // =====================================================

  // Token versions are checked by both /auth/me and JwtAuthGuard.
  // Incrementing the version revokes all existing sessions for this account.
  async logout(user: { id: string; tenantId: string }) {
    await this.prisma.user.updateMany({
      where: { id: user.id, tenantId: user.tenantId },
      data: { tokenVersion: { increment: 1 } },
    });
    return { message: 'Signed out. All existing account sessions have been revoked.' };
  }

  async me(authorization?: string) {
    const token = authorization?.startsWith('Bearer ')
      ? authorization.slice(7).trim()
      : '';

    if (!token) {
      throw new UnauthorizedException(
        'Missing access token',
      );
    }

    let payload: {
      sub?: string;
      tenantId?: string;
      tokenVersion?: number;
    };

    try {
      payload = await this.jwtService.verifyAsync(token);
    } catch {
      throw new UnauthorizedException(
        'Invalid or expired access token',
      );
    }

    if (
      !payload.sub ||
      !payload.tenantId ||
      typeof payload.tokenVersion !== 'number'
    ) {
      throw new UnauthorizedException(
        'Invalid access token',
      );
    }

    const user = await this.getActiveUser(payload.sub);

    if (
      user.tenantId !== payload.tenantId ||
      user.tokenVersion !== payload.tokenVersion
    ) {
      throw new UnauthorizedException(
        'Invalid or revoked access token',
      );
    }

    return this.makeSession(user);
  }

  private hashOtp(id: string, otp: string) {
    return createHmac('sha256', process.env.JWT_SECRET!).update(`${id}:${otp}`).digest('hex');
  }

  private async deliverOtp(email: string, otp: string, purpose: string) {
    const host = process.env.SMTP_HOST?.trim();
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS;
    if (!host || !user || !pass) throw new InternalServerErrorException('Email delivery is not configured');
    const redirectToSender = process.env.DEV_OTP_TO_SENDER === 'true' &&
      (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test');
    const message = createOtpEmail(otp, purpose);
    if (redirectToSender) {
      message.subject = `[DEV: ${email}] ${message.subject}`;
      message.text = `Development OTP for account: ${email}\n\n${message.text}`;
    }
    const port = Number(process.env.SMTP_PORT || 465);
    await nodemailer.createTransport({ host, port, secure: port === 465,
      auth: { user, pass }, dnsTimeout: 10000, connectionTimeout: 10000,
      greetingTimeout: 10000, socketTimeout: 15000,
    }).sendMail({ from: process.env.SMTP_FROM || user, to: redirectToSender ? user : email,
      ...message });
  }

  private async issueOtp(dto: OtpDestinationDto, purpose: string, userId?: string) {
    const destination = dto.email.trim().toLowerCase();
    const now = new Date();
    // Upsert a placeholder, then claim the send slot atomically to prevent concurrent resends.
    const record = await this.prisma.otpChallenge.upsert({
      where: { purpose_channel_destination: { purpose, channel: 'email', destination } },
      create: { purpose, channel: 'email', destination, codeHash: '', expiresAt: now, sentAt: new Date(0) },
      update: {},
    });
    const id = randomUUID();
    const otp = randomInt(0, 1000000).toString().padStart(6, '0');
    const claimed = await this.prisma.otpChallenge.updateMany({
      where: { id: record.id, sentAt: { lte: new Date(now.getTime() - 60000) } },
      data: { id, codeHash: this.hashOtp(id, otp), userId: userId || null, attempts: 0,
        expiresAt: new Date(now.getTime() + 600000), verifiedAt: null, usedAt: null, sentAt: now },
    });
    if (!claimed.count) return { challengeId: record.id, message: 'Please wait 60 seconds before requesting another OTP.' };
    try {
      // Reset requests for unknown accounts have the same shape, but no message is sent.
      if (purpose === 'signup' || userId) await this.deliverOtp(destination, otp, purpose);
    } catch (error: unknown) {
      // Invalidate the unsent code and release its send slot so a retry can send a new one.
      await this.prisma.otpChallenge.updateMany({ where: { id }, data: { usedAt: new Date(), sentAt: new Date(0) } });
      // SMTP messages can contain credentials and recipients. Log only known diagnostic fields.
      const failure = error as { code?: unknown; responseCode?: unknown } | null;
      const code = typeof failure?.code === 'string' && /^[A-Z0-9_]{1,40}$/.test(failure.code)
        ? failure.code : 'UNKNOWN';
      const status = typeof failure?.responseCode === 'number' && Number.isInteger(failure.responseCode)
        ? failure.responseCode : 'unknown';
      this.logger.error(`OTP email delivery failed (code=${code}, SMTP status=${status}); check SMTP connectivity and configuration`);
      throw new ServiceUnavailableException('Unable to send OTP. Please try again later.');
    }
    return { challengeId: id, message: purpose === 'reset' ? 'If an eligible account exists, an OTP has been sent.' : 'OTP sent. It expires in 10 minutes.' };
  }

  async requestSignupOtp(dto: OtpDestinationDto) {
    const existing = await this.prisma.user.findFirst({ where: { email: dto.email.trim().toLowerCase() } });
    if (existing) throw new ConflictException('This email address is already registered');
    return this.issueOtp(dto, 'signup');
  }

  private async checkOtp(dto: VerifyOtpDto, purpose?: string, requireVerified = false) {
    const now = new Date();
    if (requireVerified) {
      // Completing a verified challenge must not spend another verification
      // attempt. Match the proof as well as its lifecycle; incorrect guesses
      // still pass through the bounded counter below.
      const verified = await this.prisma.otpChallenge.findFirst({ where: {
        id: dto.challengeId, channel: 'email', usedAt: null,
        expiresAt: { gt: now }, verifiedAt: { not: null }, attempts: { lte: 5 },
        codeHash: this.hashOtp(dto.challengeId, dto.otp), ...(purpose ? { purpose } : {}),
      } });
      if (verified && (verified.purpose !== 'reset' || verified.userId)) return verified;
    }
    // Count every comparison atomically, including concurrent requests.
    const attempt = await this.prisma.otpChallenge.updateMany({
      where: { id: dto.challengeId, channel: 'email', usedAt: null, expiresAt: { gt: now }, attempts: { lt: 5 },
        ...(purpose ? { purpose } : {}), ...(requireVerified ? { verifiedAt: { not: null } } : {}) },
      data: { attempts: { increment: 1 } },
    });
    if (!attempt.count) throw new BadRequestException('Invalid, expired or exhausted OTP. Request a new code.');
    const record = await this.prisma.otpChallenge.findUniqueOrThrow({ where: { id: dto.challengeId } });
    const actual = Buffer.from(this.hashOtp(record.id, dto.otp), 'hex');
    const expected = Buffer.from(record.codeHash, 'hex');
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual) ||
      (record.purpose === 'reset' && !record.userId)) throw new BadRequestException('Invalid or expired OTP');
    return record;
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const record = await this.checkOtp(dto);
    await this.prisma.otpChallenge.updateMany({ where: { id: record.id, usedAt: null, expiresAt: { gt: new Date() } }, data: { verifiedAt: new Date() } });
    return { message: 'OTP verified successfully' };
  }

  private async consumeOtp(tx: Prisma.TransactionClient, id: string) {
    const claimed = await tx.otpChallenge.updateMany({
      where: { id, usedAt: null, verifiedAt: { not: null }, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    if (claimed.count !== 1) throw new BadRequestException('OTP has expired or has already been used');
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findFirst({ where: {
      email: dto.email.trim().toLowerCase(), status: 'ACTIVE', tenant: { status: 'ACTIVE' },
    }, select: { id: true } });
    return this.issueOtp(dto, 'reset', user?.id);
  }

  async resetPassword(dto: ResetPasswordDto) {
    if (dto.newPassword !== dto.confirmPassword) throw new BadRequestException('Passwords do not match');
    if (!dto.newPassword.trim() || dto.newPassword.length < 8 || dto.newPassword.length > 128) throw new BadRequestException('Password must contain 8 to 128 characters');
    const record = await this.checkOtp(dto, 'reset', true);
    const hashedPassword = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.$transaction(async tx => {
      await this.consumeOtp(tx, record.id);
      const updated = await tx.user.updateMany({ where: { id: record.userId!, status: 'ACTIVE', tenant: { status: 'ACTIVE' } },
        data: { password: hashedPassword, tokenVersion: { increment: 1 } } });
      if (updated.count !== 1) throw new BadRequestException('Invalid or inactive account');
      await tx.otpChallenge.updateMany({ where: { userId: record.userId, purpose: 'reset', usedAt: null }, data: { usedAt: new Date() } });
      await tx.passwordResetToken.updateMany({ where: { userId: record.userId!, usedAt: null }, data: { usedAt: new Date() } });
    });
    return { message: 'Password reset successful. Please sign in with your new password.' };
  }
}
