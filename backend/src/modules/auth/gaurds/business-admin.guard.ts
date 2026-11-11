
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service';
import {
  evaluateSubscriptionAccess,
  SUBSCRIPTION_REQUIRED_MESSAGE,
} from '../../../common/subscription-access';

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
        planId: true,
        status: true,
        expiresAt: true,
        currentPeriodEnd: true,
        billingModel: true,
      },
    });

    // Fail closed when the record is missing, unpaid, invalid or ended.
    if (!evaluateSubscriptionAccess(subscription).allowed) {
      throw new ForbiddenException(SUBSCRIPTION_REQUIRED_MESSAGE);
    }

    return true;
  }
}
