
import {
  Controller,
  Get,
  Req,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/gaurds/jwt-auth.guard';

import { BusinessScopeGuard } from '../auth/gaurds/business-scope.guard';

import { PermissionsGuard } from '../auth/gaurds/permissions.guard';

import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('dashboard')
@UseGuards(
  JwtAuthGuard,
  BusinessScopeGuard,
  PermissionsGuard,
)
@RequirePermissions('crm.read')
export class DashboardController {
  constructor(private readonly prisma: PrismaService) {}
  @Get()
  async getDashboard(@Req() request: { businessScope: { tenantId: string; companyId: string; branchId: string } }) {
    const where = request.businessScope;
    const [leads, customers, openDeals, pipeline, quotesAwaitingResponse, recentActivity] = await Promise.all([
      this.prisma.lead.count({ where }),
      this.prisma.customer.count({ where }),
      this.prisma.deal.count({ where: { ...where, stage: { notIn: ['WON', 'LOST'] } } }),
      this.prisma.deal.aggregate({ where: { ...where, stage: { notIn: ['WON', 'LOST'] } }, _sum: { amount: true } }),
      this.prisma.quote.count({ where: { ...where, status: 'SENT' } }),
      this.prisma.auditEvent.findMany({ where: { ...where, module: 'CRM' }, orderBy: { createdAt: 'desc' }, take: 10 }),
    ]);
    return {
      leads,
      customers,
      openDeals,
      pipelineValue: Number(pipeline._sum.amount ?? 0),
      quotesAwaitingResponse,
      currency: 'INR',
      recentActivity,
    };
  }
}
