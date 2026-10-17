import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/gaurds/jwt-auth.guard';
import { BusinessAdminGuard } from '../auth/gaurds/business-admin.guard';

@Controller('subscriptions')
@UseGuards(JwtAuthGuard, BusinessAdminGuard)
export class SubscriptionsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('current')
  current(@Req() request: { authUser: { tenantId: string } }) {
    return this.prisma.businessSubscription.findUnique({
      where: { tenantId: request.authUser.tenantId },
      select: { id: true, planId: true, billingCycle: true, status: true, createdAt: true, updatedAt: true },
    });
  }
}
