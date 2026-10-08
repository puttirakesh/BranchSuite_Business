import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PrismaService } from "../../../prisma/prisma.service";
import { REQUIRED_PERMISSION } from "../decorators/permissions.decorator";
import { AuthenticatedRequest } from "./jwt-auth.guard";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permission = this.reflector.getAllAndOverride<string>(
      REQUIRED_PERMISSION,
      [context.getHandler(), context.getClass()],
    );
    if (!permission) return true;
    const req = context
      .switchToHttp()
      .getRequest<
        AuthenticatedRequest & {
          headers: AuthenticatedRequest["headers"] &
            Record<string, string | undefined>;
        }
      >();
    if (!req.user) throw new ForbiddenException("Authentication required");
    const tenantId = req.headers["x-tenant-id"];
    const companyId = req.headers["x-company-id"];
    const branchId = req.headers["x-branch-id"];
    if (!tenantId || !companyId || !branchId || tenantId !== req.user.tenantId)
      throw new ForbiddenException("Invalid scope");
    const user = await this.prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        roles: {
          include: {
            role: {
              include: { permissions: { include: { permission: true } } },
            },
          },
        },
        companyAccess: true,
        branchAccess: true,
      },
    });
    if (!user || user.status !== "ACTIVE")
      throw new ForbiddenException("Inactive account");
    const admin = req.user.portal === "BUSINESS";
    const allowedNames = admin
      ? ["BUSINESS_OWNER", "BUSINESS_ADMIN"]
      : [
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
    const roles = user.roles.filter((r) => allowedNames.includes(r.role.name));
    if (
      !roles.some((r) =>
        r.role.permissions.some((p) => p.permission.key === permission),
      )
    )
      throw new ForbiddenException("Permission denied");
    const branch = await this.prisma.branch.findFirst({
      where: {
        id: branchId,
        companyId,
        status: "ACTIVE",
        company: { tenantId, status: "ACTIVE" },
      },
    });
    if (!branch)
      throw new ForbiddenException("Branch does not belong to company");
    if (
      !admin &&
      (!user.branchAccess.some((b) => b.branchId === branchId) ||
        !user.companyAccess.some((c) => c.companyId === companyId))
    ) {
      throw new ForbiddenException("Branch access denied");
    }
    return true;
  }
}
