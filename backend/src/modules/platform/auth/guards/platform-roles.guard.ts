
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PlatformRole } from '@prisma/client';

import {
  PLATFORM_ROLES_KEY,
} from '../decorators/platform-roles.decorator';

import {
  AuthenticatedPlatformUser,
} from './platform-jwt.guard';

@Injectable()
export class PlatformRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles =
      this.reflector.getAllAndOverride<PlatformRole[]>(
        PLATFORM_ROLES_KEY,
        [context.getHandler(), context.getClass()],
      );

    // Secure default: a platform endpoint must declare allowed roles.
    if (!requiredRoles?.length) {
      throw new ForbiddenException(
        'Platform endpoint permissions are not configured',
      );
    }

    const request = context.switchToHttp().getRequest<{
      platformUser?: AuthenticatedPlatformUser;
    }>();

    const user = request.platformUser;

    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException(
        'You do not have permission to access this resource',
      );
    }

    return true;
  }
}
