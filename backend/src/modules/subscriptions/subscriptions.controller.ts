import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/gaurds/jwt-auth.guard';
import { BusinessAdminGuard } from '../auth/gaurds/business-admin.guard';
import { planLimits, planUsage } from '../../common/plan-limits';

@Controller('subscriptions')
@UseGuards(JwtAuthGuard, BusinessAdminGuard)
export class SubscriptionsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('current')
  async current(@Req() request: { authUser: { tenantId: string } }) {
    const tenantId = request.authUser.tenantId;
    const subscription = await this.prisma.businessSubscription.findUnique({
      where: { tenantId },
      select: { id: true, planId: true, billingCycle: true, status: true, createdAt: true, updatedAt: true },
    });
    if (!subscription) return null;
    const [limits, usage] = await Promise.all([planLimits(this.prisma, tenantId), planUsage(this.prisma, tenantId)]);
    return { ...subscription, limits, usage };
  }
}
