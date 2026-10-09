
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { JwtService } from '@nestjs/jwt';

import { PrismaService } from '../../../prisma/prisma.service';

// =====================================================
// JWT PAYLOAD TYPE
// =====================================================

interface AuthJwtPayload {
  sub?: string;
  tenantId?: string;
  tokenVersion?: number;
  iat?: number;
  exp?: number;
}

// =====================================================
// JWT AUTHENTICATION GUARD
// =====================================================

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  // =====================================================
  // VALIDATE ACCESS TOKEN
  // =====================================================

  async canActivate(
    context: ExecutionContext,
  ): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // ===================================================
    // 1. EXTRACT BEARER TOKEN
    // ===================================================

    const authorization = request.headers.authorization;

    if (
      typeof authorization !== "string" ||
      !authorization.startsWith("Bearer ")
    ) {
      throw new UnauthorizedException(
        "Missing access token"
      );
    }

    const token = authorization.slice(7).trim();

    if (!token) {
      throw new UnauthorizedException(
        "Missing access token"
      );
    }

    // ===================================================
    // 2. VERIFY JWT SIGNATURE AND EXPIRATION
    // ===================================================

    let payload: AuthJwtPayload;

    try {
      payload =
        await this.jwtService.verifyAsync<AuthJwtPayload>(
          token
        );
    } catch {
      throw new UnauthorizedException(
        "Invalid or expired access token"
      );
    }

    // ===================================================
    // 3. VALIDATE REQUIRED JWT CLAIMS
    // ===================================================

    if (
      !payload.sub ||
      !payload.tenantId ||
      typeof payload.tokenVersion !== "number" ||
      !Number.isInteger(payload.tokenVersion) ||
      payload.tokenVersion < 0
    ) {
      throw new UnauthorizedException(
        "Invalid access token"
      );
    }

    // ===================================================
    // 4. FETCH USER AND TENANT FROM POSTGRESQL
    // ===================================================

    const user = await this.prisma.user.findUnique({
      where: {
        id: payload.sub,
      },

      include: {
        tenant: true,

        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    // ===================================================
    // 5. VALIDATE USER AND TENANT STATUS
    // ===================================================

    if (
      !user ||
      user.status !== "ACTIVE" ||
      !user.tenantId ||
      user.tenantId !== payload.tenantId ||
      user.tenant?.status !== "ACTIVE"
    ) {
      throw new UnauthorizedException(
        "Account is not active"
      );
    }

    // ===================================================
    // 6. VALIDATE TOKEN VERSION
    // ===================================================

    // The version is stored in PostgreSQL.
    //
    // When a password reset succeeds:
    //   user.tokenVersion increments by 1.
    //
    // Previously issued JWTs still contain
    // the old version and are rejected.

    if (user.tokenVersion !== payload.tokenVersion) {
      throw new UnauthorizedException(
        "Your session has expired. Please sign in again."
      );
    }

    // ===================================================
    // 7. ATTACH AUTHENTICATED USER TO REQUEST
    // ===================================================

    // Preserve the original request.authUser structure
    // so PermissionsGuard and BusinessScopeGuard
    // continue to work.

    request.authUser = {
      id: user.id,
      tenantId: user.tenantId,
      roles: user.roles.map(({ role }) => role.name),
    };

    // ===================================================
    // 8. ALLOW ACCESS
    // ===================================================

    return true;
  }
}
