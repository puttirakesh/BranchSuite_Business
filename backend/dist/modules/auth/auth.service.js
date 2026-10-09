"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var AuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const client_1 = require("@prisma/client");
const node_crypto_1 = require("node:crypto");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const prisma_service_1 = require("../../prisma/prisma.service");
let AuthService = AuthService_1 = class AuthService {
    prisma;
    jwtService;
    logger = new common_1.Logger(AuthService_1.name);
    resetTokenLifetimeMs = 30 * 60 * 1000;
    resetRequestCooldownMs = 60 * 1000;
    constructor(prisma, jwtService) {
        this.prisma = prisma;
        this.jwtService = jwtService;
    }
    userInclude = {
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
    };
    async getActiveUser(id) {
        const user = await this.prisma.user.findUnique({
            where: { id },
            include: this.userInclude,
        });
        if (!user ||
            user.status !== 'ACTIVE' ||
            !user.tenantId ||
            user.tenant?.status !== 'ACTIVE') {
            throw new common_1.UnauthorizedException('Invalid or inactive account');
        }
        return user;
    }
    makeSession(user) {
        const roles = user.roles.map((r) => r.role.name);
        const permissions = [
            ...new Set(user.roles.flatMap((r) => r.role.permissions.map((p) => p.permission.key))),
        ];
        const memberships = user.companyAccess
            .filter(({ company }) => company.status === 'ACTIVE' &&
            company.tenantId === user.tenantId)
            .map(({ company }) => ({
            id: `${user.id}:${company.id}`,
            tenantId: user.tenantId,
            companyId: company.id,
            companyName: company.name,
            role: roles.includes('BUSINESS_OWNER')
                ? 'BUSINESS_OWNER'
                : roles.includes('BUSINESS_ADMIN')
                    ? 'BUSINESS_ADMIN'
                    : roles.includes('EMPLOYEE')
                        ? 'EMPLOYEE'
                        : roles[0] ?? 'EMPLOYEE',
            permissions,
            branches: user.branchAccess
                .filter(({ branch }) => branch.companyId === company.id &&
                branch.status === 'ACTIVE')
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
    async signup(dto) {
        const businessName = dto.businessName.trim();
        const ownerName = dto.ownerName.trim();
        const email = dto.email.trim().toLowerCase();
        const phone = dto.phone.trim();
        if (!businessName || !ownerName) {
            throw new common_1.BadRequestException('Business name and owner name are required');
        }
        if (!/^[0-9]{10}$/.test(phone)) {
            throw new common_1.BadRequestException('Enter a valid 10-digit mobile number');
        }
        if (dto.password.length < 8 ||
            dto.password.length > 128) {
            throw new common_1.BadRequestException('Password must contain 8 to 128 characters');
        }
        const existingUser = await this.prisma.user.findUnique({
            where: { email },
            select: { id: true },
        });
        if (existingUser) {
            throw new common_1.ConflictException('This email address is already registered');
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
            throw new common_1.InternalServerErrorException('Business Owner role is not configured. Contact the administrator.');
        }
        const hashedPassword = await bcrypt.hash(dto.password, 12);
        try {
            const registration = await this.prisma.$transaction(async (tx) => {
                const tenant = await tx.tenant.create({
                    data: {
                        name: businessName,
                        status: 'ACTIVE',
                    },
                });
                const company = await tx.company.create({
                    data: {
                        tenantId: tenant.id,
                        name: businessName,
                        status: 'ACTIVE',
                    },
                });
                const branch = await tx.branch.create({
                    data: {
                        companyId: company.id,
                        name: 'Main Branch',
                        status: 'ACTIVE',
                    },
                });
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
                await tx.userRole.create({
                    data: {
                        userId: user.id,
                        roleId: ownerRole.id,
                    },
                });
                await tx.userCompanyAccess.create({
                    data: {
                        userId: user.id,
                        companyId: company.id,
                    },
                });
                await tx.userBranchAccess.create({
                    data: {
                        userId: user.id,
                        branchId: branch.id,
                    },
                });
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
            });
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
        }
        catch (error) {
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2002') {
                throw new common_1.ConflictException('This email address is already registered');
            }
            throw error;
        }
    }
    async login(dto) {
        const account = await this.prisma.user.findUnique({
            where: {
                email: dto.email.trim().toLowerCase(),
            },
        });
        if (!account) {
            throw new common_1.UnauthorizedException('Invalid email or password');
        }
        const passwordValid = await bcrypt.compare(dto.password, account.password);
        if (!passwordValid || account.status !== 'ACTIVE') {
            throw new common_1.UnauthorizedException('Invalid email or password');
        }
        const user = await this.getActiveUser(account.id);
        if (dto.tenantId &&
            dto.tenantId !== user.tenantId) {
            throw new common_1.UnauthorizedException('Invalid email or password');
        }
        const roles = user.roles.map((r) => r.role.name);
        const employeeOnly = roles.includes('EMPLOYEE') &&
            !roles.some((r) => [
                'BUSINESS_OWNER',
                'BUSINESS_ADMIN',
                'HR_MANAGER',
                'PAYROLL_MANAGER',
                'BRANCH_MANAGER',
                'SALES_MANAGER',
                'MANAGER',
                'SALES',
                'HR',
                'PAYROLL',
            ].includes(r));
        if ((dto.portal === 'employee' && !employeeOnly) ||
            (dto.portal === 'staff' && employeeOnly)) {
            throw new common_1.UnauthorizedException('This account cannot access the selected portal');
        }
        const session = this.makeSession(user);
        if (!session.memberships.some((membership) => membership.branches.length > 0)) {
            throw new common_1.UnauthorizedException('No active company or branch access assigned');
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
    async me(authorization) {
        const token = authorization?.startsWith('Bearer ')
            ? authorization.slice(7).trim()
            : '';
        if (!token) {
            throw new common_1.UnauthorizedException('Missing access token');
        }
        let payload;
        try {
            payload = await this.jwtService.verifyAsync(token);
        }
        catch {
            throw new common_1.UnauthorizedException('Invalid or expired access token');
        }
        if (!payload.sub ||
            !payload.tenantId ||
            typeof payload.tokenVersion !== 'number') {
            throw new common_1.UnauthorizedException('Invalid access token');
        }
        const user = await this.getActiveUser(payload.sub);
        if (user.tenantId !== payload.tenantId ||
            user.tokenVersion !== payload.tokenVersion) {
            throw new common_1.UnauthorizedException('Invalid or revoked access token');
        }
        return this.makeSession(user);
    }
    hashResetToken(token) {
        return (0, node_crypto_1.createHash)('sha256')
            .update(token)
            .digest('hex');
    }
    createMailTransporter() {
        const host = process.env.SMTP_HOST?.trim();
        const port = Number(process.env.SMTP_PORT || 465);
        const user = process.env.SMTP_USER?.trim();
        const pass = process.env.SMTP_PASS;
        if (!host ||
            !user ||
            !pass ||
            !Number.isInteger(port) ||
            port < 1 ||
            port > 65535) {
            throw new common_1.InternalServerErrorException('SMTP email configuration is missing or invalid');
        }
        return nodemailer.createTransport({
            host,
            port,
            secure: port === 465,
            auth: {
                user,
                pass,
            },
            connectionTimeout: 10000,
            greetingTimeout: 10000,
            socketTimeout: 15000,
        });
    }
    async sendPasswordResetEmail(email, resetToken) {
        const transporter = this.createMailTransporter();
        const sender = process.env.SMTP_FROM?.trim() ||
            process.env.SMTP_USER?.trim();
        if (!sender) {
            throw new common_1.InternalServerErrorException('SMTP sender is not configured');
        }
        const resetUrl = process.env.PASSWORD_RESET_URL?.trim();
        let resetLink;
        if (resetUrl) {
            const url = new URL(resetUrl);
            if (url.protocol !== 'https:' &&
                !(process.env.NODE_ENV !== 'production' &&
                    url.protocol === 'http:')) {
                throw new Error('PASSWORD_RESET_URL must use HTTPS');
            }
            url.searchParams.set('token', resetToken);
            resetLink = url.toString();
        }
        const emailText = [
            'BranchSuite Business',
            '',
            'Password Reset Request',
            '',
            'We received a request to reset your password.',
            '',
            'Your password reset token:',
            resetToken,
            '',
            'Open the BranchSuite Business Reset Password screen.',
            'Paste the token and enter your new password.',
            '',
            ...(resetLink
                ? [
                    'Reset link:',
                    resetLink,
                    '',
                ]
                : []),
            'This token expires in 30 minutes.',
            'This token can only be used once.',
            '',
            'If you did not request this password reset,',
            'please ignore this email.',
            '',
            'Never share your reset token.',
            '',
            'BranchSuite Business Team',
        ].join('\n');
        const safeLink = resetLink
            ? resetLink
                .replace(/&/g, '&amp;')
                .replace(/"/g, '&quot;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
            : undefined;
        const emailHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1"
        />
      </head>

      <body style="
        margin:0;
        padding:30px 15px;
        background-color:#f4f6fb;
        font-family:Arial,Helvetica,sans-serif;
        color:#1f2937;
      ">

        <div style="
          max-width:540px;
          margin:auto;
          padding:32px;
          background:#ffffff;
          border-radius:14px;
          border:1px solid #e5e7eb;
        ">

          <h2 style="
            color:#2456c6;
            margin-top:0;
          ">
            BranchSuite Business
          </h2>

          <h3>
            Reset Your Password
          </h3>

          <p>
            We received a request to reset your
            BranchSuite Business account password.
          </p>

          <p>
            Use the secure token below:
          </p>

          <div style="
            padding:16px;
            background:#eef3ff;
            border-radius:8px;
            border:1px solid #d5e0fa;
            font-family:monospace;
            font-size:13px;
            word-break:break-all;
          ">
            ${resetToken}
          </div>

          ${safeLink
            ? `
                <p style="margin-top:24px;">
                  Or click the button below:
                </p>

                <a
                  href="${safeLink}"
                  style="
                    display:inline-block;
                    padding:12px 22px;
                    background:#2456c6;
                    color:#ffffff;
                    border-radius:8px;
                    text-decoration:none;
                    font-weight:bold;
                  "
                >
                  Reset Password
                </a>
              `
            : ''}

          <p style="margin-top:24px;">
            <strong>
              This token expires in 30 minutes.
            </strong>
          </p>

          <p>
            It can only be used once.
          </p>

          <p style="
            font-size:13px;
            color:#6b7280;
          ">
            If you did not request this password reset,
            you can safely ignore this email.
          </p>

          <hr style="
            border:none;
            border-top:1px solid #e5e7eb;
            margin:24px 0;
          " />

          <p style="
            font-size:12px;
            color:#9ca3af;
          ">
            BranchSuite Business Security Team
          </p>

        </div>
      </body>
      </html>
    `;
        await transporter.sendMail({
            from: sender,
            to: email,
            subject: 'BranchSuite Business - Reset Your Password',
            text: emailText,
            html: emailHtml,
        });
    }
    async forgotPassword(dto) {
        const email = dto.email.trim().toLowerCase();
        const response = {
            message: 'If an eligible account exists for this email, password reset instructions will be sent.',
        };
        const user = await this.prisma.user.findUnique({
            where: {
                email,
            },
            select: {
                id: true,
                status: true,
                tenant: {
                    select: {
                        status: true,
                    },
                },
            },
        });
        if (!user ||
            user.status !== 'ACTIVE' ||
            user.tenant?.status !== 'ACTIVE') {
            return response;
        }
        const latestToken = await this.prisma.passwordResetToken.findFirst({
            where: {
                userId: user.id,
            },
            orderBy: {
                createdAt: 'desc',
            },
            select: {
                createdAt: true,
            },
        });
        if (latestToken &&
            Date.now() - latestToken.createdAt.getTime() <
                this.resetRequestCooldownMs) {
            return response;
        }
        const resetToken = (0, node_crypto_1.randomBytes)(32).toString('hex');
        const tokenHash = this.hashResetToken(resetToken);
        const expiresAt = new Date(Date.now() + this.resetTokenLifetimeMs);
        const resetRecord = await this.prisma.passwordResetToken.create({
            data: {
                userId: user.id,
                tokenHash,
                expiresAt,
            },
            select: {
                id: true,
            },
        });
        try {
            await this.sendPasswordResetEmail(email, resetToken);
        }
        catch (error) {
            await this.prisma.passwordResetToken
                .updateMany({
                where: {
                    id: resetRecord.id,
                    usedAt: null,
                },
                data: {
                    usedAt: new Date(),
                },
            })
                .catch(() => undefined);
            this.logger.error('Password reset email sending failed', error instanceof Error
                ? error.stack
                : String(error));
            return response;
        }
        return response;
    }
    async resetPassword(dto) {
        const token = dto.token.trim();
        const newPassword = dto.newPassword;
        const confirmPassword = dto.confirmPassword;
        if (!/^[a-f0-9]{64}$/i.test(token)) {
            throw new common_1.BadRequestException('Invalid or expired password reset token');
        }
        if (newPassword.length < 8 ||
            newPassword.length > 128) {
            throw new common_1.BadRequestException('Password must contain 8 to 128 characters');
        }
        if (newPassword !== confirmPassword) {
            throw new common_1.BadRequestException('New password and confirm password do not match');
        }
        const tokenHash = this.hashResetToken(token);
        const resetRecord = await this.prisma.passwordResetToken.findUnique({
            where: {
                tokenHash,
            },
            select: {
                id: true,
                userId: true,
                usedAt: true,
                expiresAt: true,
                user: {
                    select: {
                        status: true,
                        tenant: {
                            select: {
                                status: true,
                            },
                        },
                    },
                },
            },
        });
        if (!resetRecord ||
            resetRecord.usedAt ||
            resetRecord.expiresAt <= new Date() ||
            resetRecord.user.status !== 'ACTIVE' ||
            resetRecord.user.tenant?.status !== 'ACTIVE') {
            throw new common_1.BadRequestException('Invalid or expired password reset token');
        }
        const hashedPassword = await bcrypt.hash(newPassword, 12);
        const now = new Date();
        await this.prisma.$transaction(async (tx) => {
            const claimed = await tx.passwordResetToken.updateMany({
                where: {
                    id: resetRecord.id,
                    userId: resetRecord.userId,
                    usedAt: null,
                    expiresAt: {
                        gt: now,
                    },
                },
                data: {
                    usedAt: now,
                },
            });
            if (claimed.count !== 1) {
                throw new common_1.BadRequestException('Invalid or expired password reset token');
            }
            await tx.user.update({
                where: {
                    id: resetRecord.userId,
                },
                data: {
                    password: hashedPassword,
                    tokenVersion: {
                        increment: 1,
                    },
                },
            });
            await tx.passwordResetToken.updateMany({
                where: {
                    userId: resetRecord.userId,
                    usedAt: null,
                },
                data: {
                    usedAt: now,
                },
            });
        });
        return {
            message: 'Password reset successful. Please log in with your new password.',
        };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = AuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService])
], AuthService);
//# sourceMappingURL=auth.service.js.map