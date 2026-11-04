
import { Injectable } from '@nestjs/common';
import { SubscriptionStatus } from '@prisma/client';

import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class PlatformDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary() {
    const [
      totalBusinesses,
      totalCompanies,
      activeSubscriptions,
      totalSubscriptions,
      openSupportTickets,
      totalSupportTickets,
      paidInvoices,
      recentActivity,
    ] = await Promise.all([
      this.prisma.tenant.count(),

      this.prisma.company.count(),

      this.prisma.businessSubscription.count({
        where: {
          status: SubscriptionStatus.ACTIVE,
        },
      }),

      this.prisma.businessSubscription.count(),

      this.prisma.supportTicket.count({
        where: {
          status: 'OPEN',
        },
      }),

      this.prisma.supportTicket.count(),

      this.prisma.billingInvoice.aggregate({
        where: {
          paidAt: {
            not: null,
          },
          currency: 'INR',
        },
        _sum: {
          amount: true,
        },
        _count: {
          id: true,
        },
      }),

      this.prisma.auditEvent.findMany({
        orderBy: {
          createdAt: 'desc',
        },
        take: 10,
        select: {
          id: true,
          tenantId: true,
          companyId: true,
          actorId: true,
          action: true,
          module: true,
          targetId: true,
          detail: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      businesses: {
        total: totalBusinesses,
        totalCompanies,
      },

      subscriptions: {
        total: totalSubscriptions,
        active: activeSubscriptions,
      },

      revenue: {
        currency: 'INR',
        totalPaid: paidInvoices._sum.amount?.toString() ?? '0',
        paidInvoiceCount: paidInvoices._count.id,
      },

      support: {
        totalTickets: totalSupportTickets,
        openTickets: openSupportTickets,
      },

      recentActivity,
    };
  }
}
