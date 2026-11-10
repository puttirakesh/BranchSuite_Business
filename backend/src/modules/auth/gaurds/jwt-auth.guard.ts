import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";

import { JwtService } from "@nestjs/jwt";
import { Reflector } from "@nestjs/core";
import { PrismaService } from "../../../prisma/prisma.service";
import { requestCompany } from "../../../common/company-scope";
import { PLAN_LIMITS } from "../../../common/plan-limits";
import { ALLOW_PENDING_SUBSCRIPTION_KEY } from "../decorators/allow-pending-subscription.decorator";

// =====================================================
// JWT PAYLOAD
// =====================================================

interface AuthJwtPayload {
  sub?: string;
  tenantId?: string;
  tokenVersion?: number;
  iat?: number;
  exp?: number;
}

// =====================================================
// AUTHENTICATED REQUEST USER
// =====================================================

interface AuthenticatedUser {
  companyId?: string;
  id: string;
  tenantId: string;
  roles: string[];
}

// =====================================================
// JWT AUTHENTICATION GUARD
// =====================================================

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: {
        authorization?: string;
        "x-company-id"?: string;
      };
      body?: { companyId?: unknown };
      query?: { companyId?: unknown };
      authUser?: AuthenticatedUser;
    }>();

    // =================================================
    // STEP 1: EXTRACT BEARER TOKEN
    // =================================================

    const authorization = request.headers.authorization;

    if (
      typeof authorization !== "string" ||
      !/^Bearer\s+/i.test(authorization)
    ) {
      throw new UnauthorizedException("Missing access token");
    }

    const token = authorization.replace(/^Bearer\s+/i, "").trim();

    if (!token || /\s/.test(token)) {
      throw new UnauthorizedException("Invalid access token");
    }

    // =================================================
    // STEP 2: VERIFY JWT SIGNATURE AND EXPIRATION
    // =================================================

    let payload: AuthJwtPayload;

    try {
      payload = await this.jwtService.verifyAsync<AuthJwtPayload>(token);
    } catch (error: unknown) {
      // Development diagnostic only.
      // Never log the JWT or signing secret.
      const errorName = error instanceof Error ? error.name : "UnknownJwtError";

      console.error("[JWT AUTH] Verification failed:", errorName);

      throw new UnauthorizedException("Invalid or expired access token");
    }

    // =================================================
    // STEP 3: VALIDATE REQUIRED JWT CLAIMS
    // =================================================

    if (
      typeof payload.sub !== "string" ||
      !payload.sub ||
      typeof payload.tenantId !== "string" ||
      !payload.tenantId ||
      typeof payload.tokenVersion !== "number" ||
      !Number.isSafeInteger(payload.tokenVersion) ||
      payload.tokenVersion < 0
    ) {
      throw new UnauthorizedException("Invalid access token");
    }

    // =================================================
    // STEP 4: FETCH CURRENT USER FROM DATABASE
    // =================================================

    const user = await this.prisma.user.findUnique({
      where: {
        id: payload.sub,
      },
      select: {
        id: true,
        tenantId: true,
        status: true,
        tokenVersion: true,

        tenant: {
          select: {
            status: true,
          },
        },

        roles: {
          select: {
            companyId: true,
            role: {
              select: {
                name: true,
              },
            },
          },
        },
        companyAccess: { select: { companyId: true } },
      },
    });

    // =================================================
    // STEP 5: VERIFY ACCOUNT AND TENANT STATUS
    // =================================================

    if (
      !user ||
      user.status !== "ACTIVE" ||
      user.tenantId !== payload.tenantId ||
      user.tenant?.status !== "ACTIVE"
    ) {
      throw new UnauthorizedException("Account is not active");
    }

    // =================================================
    // STEP 6: VERIFY TOKEN VERSION
    // =================================================

    if (user.tokenVersion !== payload.tokenVersion) {
      throw new UnauthorizedException(
        "Your session has expired. Please sign in again.",
      );
    }

    // =================================================
    // STEP 7: ATTACH AUTHENTICATED USER
    // =================================================

    const companyId = requestCompany(request);
    const companyAccess = new Set(
      user.companyAccess.map((access) => access.companyId),
    );
    const roles = user.roles
      .filter(
        ({ companyId: roleCompanyId, role }) =>
          (roleCompanyId === null &&
            ["BUSINESS_OWNER", "BUSINESS_ADMIN", "EMPLOYEE"].includes(
              role.name,
            )) ||
          (typeof companyId === "string" &&
            companyId === roleCompanyId &&
            companyAccess.has(companyId)),
      )
      .map(({ role }) => role.name);

    request.authUser = {
      companyId,
      id: user.id,
      tenantId: user.tenantId,
      roles,
    };

    const subscription = await this.prisma.businessSubscription.findUnique({
      where: { tenantId: user.tenantId },
      select: {
        planId: true,
        status: true,
        expiresAt: true,
        currentPeriodEnd: true,
      },
    });
    const allowPending = this.reflector.getAllAndOverride<boolean>(
      ALLOW_PENDING_SUBSCRIPTION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (subscription) {
      const now = Date.now();
      const invalidPlan = !Object.hasOwn(PLAN_LIMITS, subscription.planId);
      const inactive =
        subscription.status !== "ACTIVE" ||
        (subscription.expiresAt !== null &&
          subscription.expiresAt.getTime() <= now) ||
        (subscription.currentPeriodEnd !== null &&
          subscription.currentPeriodEnd.getTime() <= now);
      if ((invalidPlan || inactive) && !allowPending) {
        throw new ForbiddenException(
          "An active paid subscription is required to access this business workspace.",
        );
      }
    }

    return true;
  }
}
