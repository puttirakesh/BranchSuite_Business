
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../../prisma/prisma.service';

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
  ) {}

  async canActivate(
    context: ExecutionContext,
  ): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<{
        headers: {
          authorization?: string;
        };
        authUser?: AuthenticatedUser;
      }>();

    // =================================================
    // STEP 1: EXTRACT BEARER TOKEN
    // =================================================

    const authorization = request.headers.authorization;

    if (
      typeof authorization !== 'string' ||
      !/^Bearer\s+/i.test(authorization)
    ) {
      throw new UnauthorizedException(
        'Missing access token',
      );
    }

    const token = authorization
      .replace(/^Bearer\s+/i, '')
      .trim();

    if (!token || /\s/.test(token)) {
      throw new UnauthorizedException(
        'Invalid access token',
      );
    }

    // =================================================
    // STEP 2: VERIFY JWT SIGNATURE AND EXPIRATION
    // =================================================

    let payload: AuthJwtPayload;

    try {
      payload =
        await this.jwtService.verifyAsync<AuthJwtPayload>(
          token,
        );
    } catch {
      throw new UnauthorizedException(
        'Invalid or expired access token',
      );
    }

    // =================================================
    // STEP 3: VALIDATE REQUIRED JWT CLAIMS
    // =================================================

    if (
      typeof payload.sub !== 'string' ||
      !payload.sub ||
      typeof payload.tenantId !== 'string' ||
      !payload.tenantId ||
      typeof payload.tokenVersion !== 'number' ||
      !Number.isSafeInteger(payload.tokenVersion) ||
      payload.tokenVersion < 0
    ) {
      throw new UnauthorizedException(
        'Invalid access token',
      );
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
            role: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    // =================================================
    // STEP 5: VERIFY ACCOUNT AND TENANT STATUS
    // =================================================

    if (
      !user ||
      user.status !== 'ACTIVE' ||
      user.tenantId !== payload.tenantId ||
      user.tenant?.status !== 'ACTIVE'
    ) {
      throw new UnauthorizedException(
        'Account is not active',
      );
    }

    // =================================================
    // STEP 6: VERIFY TOKEN VERSION
    // =================================================

    if (user.tokenVersion !== payload.tokenVersion) {
      throw new UnauthorizedException(
        'Your session has expired. Please sign in again.',
      );
    }

    // =================================================
    // STEP 7: ATTACH AUTHENTICATED USER
    // =================================================

    request.authUser = {
      id: user.id,
      tenantId: user.tenantId,
      roles: user.roles.map(
        ({ role }) => role.name,
      ),
    };

    return true;
  }
}
