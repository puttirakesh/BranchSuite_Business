
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class BusinessAdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const roles: string[] = request.authUser?.roles ?? [];

    if (
      !roles.includes('BUSINESS_ADMIN') &&
      !roles.includes('BUSINESS_OWNER')
    ) {
      throw new ForbiddenException(
        'Business administrator access required',
      );
    }

    const tenantId = request.authUser?.tenantId;
    if (!tenantId) {
      throw new ForbiddenException(
        'Business subscription is not available for this account.',
      );
    }

    const subscription = await this.prisma.businessSubscription.findUnique({
      where: { tenantId },
      select: {
        status: true,
        expiresAt: true,
        currentPeriodEnd: true,
      },
    });

    const now = new Date();
    if (!subscription) {
      return true;
    }

    if (
      subscription.status !== 'ACTIVE' ||
      (subscription.expiresAt !== null &&
        subscription.expiresAt.getTime() <= now.getTime()) ||
      (subscription.currentPeriodEnd !== null &&
        subscription.currentPeriodEnd.getTime() <= now.getTime())
    ) {
      throw new ForbiddenException(
        'An active paid subscription is required to access this business workspace.',
      );
    }

    return true;
  }
}
