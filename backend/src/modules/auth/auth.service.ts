import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Prisma } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { randomBytes, createHash } from "node:crypto";
import * as nodemailer from "nodemailer";
import { PrismaService } from "../../prisma/prisma.service";
import { LoginDto } from "./dto/login.dto";
import { LoginType } from "./enums/login-type.enum";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";

const userInclude = Prisma.validator<Prisma.UserInclude>()({
  roles: {
    include: {
      role: { include: { permissions: { include: { permission: true } } } },
    },
  },
  companyAccess: { include: { company: true } },
  branchAccess: { include: { branch: { include: { company: true } } } },
});
type UserWithAccess = Prisma.UserGetPayload<{ include: typeof userInclude }>;
const BUSINESS = ["BUSINESS_OWNER", "BUSINESS_ADMIN"];
const EMPLOYEE = [
  "EMPLOYEE",
  "HR_MANAGER",
  "PAYROLL_MANAGER",
  "BRANCH_MANAGER",
  "SALES_MANAGER",
  "MANAGER",
  "SALES",
  "HR",
  "PAYROLL",
];
const sha = (token: string) => createHash("sha256").update(token).digest("hex");
const freshToken = () => randomBytes(32).toString("hex");

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async tenants() {
    return this.prisma.tenant.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 100,
    });
  }
  private async userById(id: string) {
    return this.prisma.user.findUnique({ where: { id }, include: userInclude });
  }
  private roles(user: UserWithAccess, portal: LoginType) {
    const allowed = portal === LoginType.BUSINESS ? BUSINESS : EMPLOYEE;
    return user.roles.filter((entry) => allowed.includes(entry.role.name));
  }
  private async sessionFor(user: UserWithAccess, portal: LoginType) {
    const assigned = this.roles(user, portal);
    if (!assigned.length)
      throw new UnauthorizedException(
        "Account cannot access this login portal",
      );
    const companies = await this.prisma.company.findMany({
      where: { tenantId: user.tenantId!, status: "ACTIVE" },
      include: { branches: { where: { status: "ACTIVE" } } },
    });
    const admin = portal === LoginType.BUSINESS;
    const permittedCompanies = new Set(
      user.companyAccess.map((a) => a.companyId),
    );
    const permittedBranches = new Set(user.branchAccess.map((a) => a.branchId));
    const memberships = companies
      .filter(
        (company) =>
          admin ||
          permittedCompanies.has(company.id) ||
          company.branches.some((b) => permittedBranches.has(b.id)),
      )
      .flatMap((company) =>
        assigned.map(({ role }) => ({
          id: `${user.id}:${company.id}:${role.id}`,
          tenantId: user.tenantId!,
          companyId: company.id,
          companyName: company.name,
          role: role.name,
          permissions: role.permissions.map((rp) => rp.permission.key),
          branches: company.branches
            .filter((b) => admin || permittedBranches.has(b.id))
            .map((b) => ({ id: b.id, name: b.name })),
        })),
      );
    if (!memberships.length)
      throw new UnauthorizedException("No active company access assigned");
    return {
      user: { id: user.id, name: user.name, email: user.email },
      memberships,
    };
  }
  private async issue(user: UserWithAccess, portal: LoginType) {
    const session = await this.sessionFor(user, portal);
    const refreshToken = freshToken();
    const dbSession = await this.prisma.authSession.create({
      data: {
        userId: user.id,
        portal,
        refreshTokenHash: sha(refreshToken),
        expiresAt: new Date(Date.now() + 30 * 86400000),
      },
    });
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      tenantId: user.tenantId,
      sid: dbSession.id,
      portal,
    });
    return { accessToken, refreshToken, session };
  }
  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
      include: userInclude,
    });
    // Always respond with the same error for invalid credentials, inactive tenants, or wrong membership.
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: dto.tenantId },
    });
    if (
      !user ||
      !tenant ||
      tenant.status !== "ACTIVE" ||
      user.tenantId !== tenant.id ||
      user.status !== "ACTIVE" ||
      !(await bcrypt.compare(dto.password, user.password)) ||
      !this.roles(user, dto.loginType).length
    ) {
      throw new UnauthorizedException("Invalid credentials or login type");
    }
    return this.issue(user, dto.loginType);
  }
  async me(auth: {
    id: string;
    tenantId: string;
    portal: "BUSINESS" | "EMPLOYEE";
  }) {
    const user = await this.userById(auth.id);
    if (!user || user.status !== "ACTIVE" || user.tenantId !== auth.tenantId)
      throw new UnauthorizedException();
    return this.sessionFor(user, auth.portal as LoginType);
  }
  async refresh(token: string) {
    const stored = await this.prisma.authSession.findUnique({
      where: { refreshTokenHash: sha(token) },
    });
    if (!stored || stored.revokedAt || stored.expiresAt <= new Date())
      throw new UnauthorizedException("Refresh session expired");
    const user = await this.userById(stored.userId);
    const portal = stored.portal as LoginType;
    if (
      !user ||
      user.status !== "ACTIVE" ||
      !user.tenantId ||
      !this.roles(user, portal).length
    )
      throw new UnauthorizedException();
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: user.tenantId },
    });
    if (tenant?.status !== "ACTIVE") throw new UnauthorizedException();
    const newToken = freshToken();
    const updated = await this.prisma.authSession.updateMany({
      where: { id: stored.id, refreshTokenHash: sha(token), revokedAt: null },
      data: { refreshTokenHash: sha(newToken) },
    });
    if (updated.count !== 1)
      throw new UnauthorizedException("Refresh token already rotated");
    const session = await this.sessionFor(user, portal);
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      tenantId: user.tenantId,
      sid: stored.id,
      portal,
    });
    return { accessToken, refreshToken: newToken, session };
  }
  async logout(sid: string) {
    await this.prisma.authSession.updateMany({
      where: { id: sid },
      data: { revokedAt: new Date() },
    });
    return { message: "Signed out" };
  }
  async forgotPassword(dto: ForgotPasswordDto) {
    const message =
      "If the account exists, a password reset link has been sent.";
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
    });
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: dto.tenantId },
    });
    if (
      !user ||
      user.tenantId !== dto.tenantId ||
      user.status !== "ACTIVE" ||
      tenant?.status !== "ACTIVE"
    )
      return { message };
    const host = process.env.SMTP_HOST,
      url = process.env.PASSWORD_RESET_URL,
      from = process.env.SMTP_FROM;
    if (!host || !url || !from)
      throw new ServiceUnavailableException("Email delivery is not configured");
    const token = freshToken();
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: sha(token),
        expiresAt: new Date(Date.now() + 15 * 60000),
      },
    });
    const resetUrl = new URL(url);
    resetUrl.searchParams.set("token", token);
    const transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
        : undefined,
    });
    try {
      await transporter.sendMail({
        from,
        to: user.email,
        subject: "BranchSuite password reset",
        text: `Reset your BranchSuite password using this link (valid 15 minutes): ${resetUrl.toString()}\nIf you did not request this, ignore this email.`,
      });
    } catch {
      throw new ServiceUnavailableException("Unable to send reset email");
    }
    return { message };
  }
  async resetPassword(dto: ResetPasswordDto) {
    const hash = sha(dto.token);
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: hash },
      include: { user: true },
    });
    if (
      !record ||
      record.usedAt ||
      record.expiresAt <= new Date() ||
      record.user.status !== "ACTIVE"
    )
      throw new BadRequestException("Reset link is invalid or expired");
    const password = await bcrypt.hash(dto.newPassword, 12);
    const result = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.passwordResetToken.updateMany({
        where: { id: record.id, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      if (!claimed.count) return false;
      await tx.user.update({
        where: { id: record.userId },
        data: { password },
      });
      await tx.authSession.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.passwordResetToken.updateMany({
        where: { userId: record.userId, usedAt: null },
        data: { usedAt: new Date() },
      });
      return true;
    });
    if (!result)
      throw new BadRequestException("Reset link is invalid or expired");
    return { message: "Password reset successfully. Please sign in." };
  }
}
