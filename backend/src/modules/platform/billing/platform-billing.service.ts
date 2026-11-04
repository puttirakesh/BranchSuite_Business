import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { ListBillingDto } from './dto/list-billing.dto';

function asUtcDate(value: string, endOfDay: boolean): Date {
  const date = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new BadRequestException('Dates must be real calendar dates in YYYY-MM-DD format');
  }
  return date;
}

@Injectable()
export class PlatformBillingService {
  constructor(private readonly prisma: PrismaService) {}

  private where(query: ListBillingDto): Prisma.BillingInvoiceWhereInput {
    const from = query.from ? asUtcDate(query.from, false) : undefined;
    const to = query.to ? asUtcDate(query.to, true) : undefined;
    if (from && to && from > to) {
      throw new BadRequestException('from must be earlier than or equal to to');
    }
    return {
      ...(query.tenantId ? { tenantId: query.tenantId } : {}),
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.currency ? { currency: query.currency } : {}),
      ...(from || to ? { issuedAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
      ...(query.search?.trim() ? {
        OR: [
          { invoiceNumber: { contains: query.search.trim(), mode: 'insensitive' as const } },
          { description: { contains: query.search.trim(), mode: 'insensitive' as const } },
        ],
      } : {}),
    };
  }

  private pagination(query: ListBillingDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    return { page, limit, skip: (page - 1) * limit };
  }

  async invoices(query: ListBillingDto) {
    const where = this.where(query);
    const { page, limit, skip } = this.pagination(query);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.billingInvoice.findMany({ where, orderBy: [{ issuedAt: 'desc' }, { id: 'desc' }], skip, take: limit }),
      this.prisma.billingInvoice.count({ where }),
    ]);
    return {
      items: items.map(item => ({ ...item, amount: item.amount.toString() })),
      total, page, limit, totalPages: Math.ceil(total / limit),
    };
  }

  async invoice(id: string) {
    const item = await this.prisma.billingInvoice.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Invoice not found');
    const [tenant, company] = await Promise.all([
      this.prisma.tenant.findUnique({ where: { id: item.tenantId }, select: { id: true, name: true, status: true } }),
      this.prisma.company.findUnique({ where: { id: item.companyId }, select: { id: true, name: true, status: true } }),
    ]);
    return { ...item, amount: item.amount.toString(), tenant, company };
  }

  async summary(query: ListBillingDto) {
    const where = this.where(query);
    // Currency groups are never summed together: a multi-currency total is misleading.
    const [groups, overdueCounts] = await Promise.all([
      this.prisma.billingInvoice.groupBy({
        by: ['currency', 'status'], where,
        _count: { _all: true }, _sum: { amount: true },
      }),
      this.prisma.billingInvoice.groupBy({
        by: ['currency'],
        where: { AND: [where, { paidAt: null, dueAt: { lt: new Date() }, status: 'ISSUED' }] },
        _count: { _all: true }, _sum: { amount: true },
      }),
    ]);
    const currencies = [...new Set([...groups.map(g => g.currency), ...overdueCounts.map(g => g.currency)])].sort();
    return {
      dateBasis: 'issuedAt (UTC)',
      currencies: currencies.map(currency => {
        const matching = groups.filter(g => g.currency === currency);
        const overdue = overdueCounts.find(g => g.currency === currency);
        return {
          currency,
          totalInvoices: matching.reduce((n, g) => n + g._count._all, 0),
          totalAmount: matching.reduce((n, g) => n.plus(g._sum.amount ?? 0), new Prisma.Decimal(0)).toFixed(2),
          byStatus: matching.map(g => ({ status: g.status, count: g._count._all, amount: (g._sum.amount ?? new Prisma.Decimal(0)).toString() })),
          overdueIssuedCount: overdue?._count._all ?? 0,
          overdueIssuedAmount: (overdue?._sum.amount ?? new Prisma.Decimal(0)).toString(),
        };
      }),
    };
  }

  async payments(query: ListBillingDto) {
    const where: Prisma.BillingInvoiceWhereInput = {
      AND: [this.where(query), { paidAt: { not: null } }],
    };
    const { page, limit, skip } = this.pagination(query);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.billingInvoice.findMany({ where, orderBy: [{ paidAt: 'desc' }, { id: 'desc' }], skip, take: limit,
        select: { id: true, invoiceNumber: true, tenantId: true, companyId: true, subscriptionId: true, status: true, amount: true, currency: true, paidAt: true, paymentNote: true },
      }),
      this.prisma.billingInvoice.count({ where }),
    ]);
    return {
      source: 'BillingInvoice.paidAt',
      note: 'Paid invoice records only. No separate payment transaction ledger exists in the current schema.',
      items: items.map(item => ({ ...item, amount: item.amount.toString() })),
      total, page, limit, totalPages: Math.ceil(total / limit),
    };
  }
}
