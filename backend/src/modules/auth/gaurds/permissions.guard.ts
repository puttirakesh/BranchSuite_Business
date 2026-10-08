
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PrismaService } from '../../../prisma/prisma.service';
import {
  PERMISSIONS_KEY,
} from '../decorators/require-permissions.decorator';

type AuthUser = {
  id: string;
  tenantId: string;
  roles: string[];
};

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(
    context: ExecutionContext,
  ): Promise<boolean> {
    const requiredPermissions =
      this.reflector.getAllAndOverride<string[]>(
        PERMISSIONS_KEY,
        [
          context.getHandler(),
          context.getClass(),
        ],
      );

    // Endpoints with no permission requirement
    // can be used by any authenticated user.
    if (!requiredPermissions?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authUser = request.authUser as AuthUser | undefined;

    if (!authUser?.id || !authUser.tenantId) {
      throw new UnauthorizedException(
        'Authentication required',
      );
    }

    // Re-read current assignments from PostgreSQL.
    // Do not trust permissions supplied by the client.
    const user = await this.prisma.user.findFirst({
      where: {
        id: authUser.id,
        tenantId: authUser.tenantId,
        status: 'ACTIVE',
        tenant: {
          status: 'ACTIVE',
        },
      },
      select: {
        roles: {
          select: {
            role: {
              select: {
                permissions: {
                  select: {
                    permission: {
                      select: {
                        key: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException(
        'Account is not active',
      );
    }

    const permissionSet = new Set(
      user.roles.flatMap(({ role }) =>
        role.permissions.map(
          ({ permission }) => permission.key,
        ),
      ),
    );

    // ALL specified permissions must be granted.
    const allowed = requiredPermissions.every(
      (permission) => permissionSet.has(permission),
    );

    if (!allowed) {
      throw new ForbiddenException(
        'Insufficient permissions',
      );
    }

    return true;
  }
}
