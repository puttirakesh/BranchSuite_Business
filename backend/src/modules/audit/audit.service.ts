import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { assertCompanyScope } from '../../common/company-scope';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type AuditActor = { id: string; tenantId: string; roles: string[]; companyId?: string };
export type AuditWrite = {
  actor: AuditActor; companyId?: string; branchId?: string;
  module: string; action: string; targetId: string;
  detail?: string; changes?: Prisma.InputJsonValue;
};

// Only the business owner sees every event; every other reader is scoped to assigned branches/companies below.
const AUDIT_READER_ROLES = ['BUSINESS_OWNER', 'BUSINESS_ADMIN', 'COMPANY_MANAGER', 'BRANCH_MANAGER', 'HR_MANAGER', 'PAYROLL_MANAGER'];

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  // Use from domain transactions when changing protected business records.
  async record(tx: Prisma.TransactionClient, event: AuditWrite): Promise<void> {
    await tx.auditEvent.create({ data: {
      tenantId: event.actor.tenantId, actorId: event.actor.id,
      companyId: event.companyId ?? null, branchId: event.branchId ?? null,
      module: event.module, action: event.action, targetId: event.targetId,
      detail: (event.detail ?? '').slice(0, 500),
      ...(event.changes === undefined ? {} : { changes: event.changes }),
    }});
  }

  async list(actor: AuditActor, query: {
    companyId?: string; branchId?: string; module?: string;
    from?: string; to?: string; cursor?: string; limit?: string;
  }) {
    query.companyId ??= actor.companyId;
    if (query.companyId) assertCompanyScope(actor, query.companyId);
    if (!actor?.id || !actor?.tenantId || !actor.roles?.some(role => AUDIT_READER_ROLES.includes(role))) {
      throw new ForbiddenException('Audit history access required');
    }
    const owner = actor.roles.includes('BUSINESS_OWNER');
    const limit = query.limit === undefined ? 40 : Number(query.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100)
      throw new BadRequestException('limit must be between 1 and 100');
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    for (const id of [query.companyId, query.branchId, query.cursor]) {
      if (id && !uuid.test(id)) throw new BadRequestException('Invalid identifier');
    }
    if (query.module && !/^[A-Z_]{2,60}$/.test(query.module))
      throw new BadRequestException('Invalid module filter');
    const rangeDate = (value?: string) => {
      if (!value) return undefined;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
        throw new BadRequestException('Dates must use YYYY-MM-DD');
      const date = new Date(`${value}T00:00:00.000Z`);
      if (Number.isNaN(date.getTime()) || date.toISOString().slice(0,10) !== value)
        throw new BadRequestException('Invalid calendar date');
      return date;
    };
    const from = rangeDate(query.from);
    const to = rangeDate(query.to);
    if (from && to && from > to) throw new BadRequestException('Start date exceeds end date');
    if (query.branchId) {
      const branch = await this.prisma.branch.findFirst({ where: {
        id: query.branchId, company: { tenantId: actor.tenantId },
        ...(!owner ? { userAccess: { some: { userId: actor.id } } } : {}),
      }, select: { companyId: true } });
      if (!branch || (query.companyId && query.companyId !== branch.companyId))
        throw new ForbiddenException('Branch access denied');
    }
    if (query.companyId) {
      const company = await this.prisma.company.findFirst({ where: {
        id: query.companyId, tenantId: actor.tenantId,
        ...(!owner ? { userAccess: { some: { userId: actor.id } } } : {}),
      }, select: { id: true } });
      if (!company) throw new ForbiddenException('Company access denied');
    }
    // Non-owner admins can read only events assigned to their accessible branches,
    // plus company-level events in companies where they have access.
    const access: Prisma.AuditEventWhereInput = owner ? {} : {
      OR: [
        { branchId: { in: (await this.prisma.userBranchAccess.findMany({
          where: { userId: actor.id, branch: { company: { tenantId: actor.tenantId } } },
          select: { branchId: true },
        })).map(item => item.branchId) } },
        { branchId: null, companyId: { in: (await this.prisma.userCompanyAccess.findMany({
          where: { userId: actor.id, company: { tenantId: actor.tenantId } },
          select: { companyId: true },
        })).map(item => item.companyId) } },
      ],
    };
    const where: Prisma.AuditEventWhereInput = {
      AND: [
        { tenantId: actor.tenantId }, access,
        ...(query.companyId ? [{ companyId: query.companyId }] : []),
        ...(query.branchId ? [{ branchId: query.branchId }] : []),
        ...(query.module ? [{ module: query.module }] : []),
        ...(from || to ? [{ createdAt: {
          ...(from ? { gte: from } : {}),
          ...(to ? { lt: new Date(to.getTime() + 86400000) } : {}),
        } }] : []),
      ],
    };
    const data = await this.prisma.auditEvent.findMany({
      where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const hasMore = data.length > limit;
    const items = data.slice(0, limit);
    return { items, nextCursor: hasMore ? items[items.length - 1].id : null };
  }
}
