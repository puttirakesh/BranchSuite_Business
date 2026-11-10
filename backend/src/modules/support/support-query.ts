import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ListPlatformTicketsDto } from '../platform/support/dto/support.dto';

export const slaSql = Prisma.sql`CASE
 WHEN t."responseDueAt" IS NULL OR t."resolutionDueAt" IS NULL THEN 'NOT_TRACKED'
 WHEN COALESCE(t."firstResponseAt",CURRENT_TIMESTAMP)>t."responseDueAt" OR COALESCE(t."resolvedAt",CURRENT_TIMESTAMP)>t."resolutionDueAt" THEN 'OVERDUE'
 WHEN t."firstResponseAt" IS NOT NULL AND t."resolvedAt" IS NOT NULL THEN 'MET'
 WHEN (t."firstResponseAt" IS NULL AND t."responseDueAt"<=CURRENT_TIMESTAMP+INTERVAL '60 minutes') OR (t."resolvedAt" IS NULL AND t."resolutionDueAt"<=CURRENT_TIMESTAMP+INTERVAL '60 minutes') THEN 'DUE_SOON'
 ELSE 'ON_TRACK' END`;

export const unreadSql = (actorId: string) => Prisma.sql`NOT EXISTS (SELECT 1 FROM "SupportTicketReadState" r WHERE r."ticketId"=t.id AND r."platformUserId"=${actorId} AND r."lastReadCustomerVersion">=t."customerActivityVersion")`;

export function ticketWhere(q: ListPlatformTicketsDto, actorId: string): Prisma.Sql {
  const parts: Prisma.Sql[] = [Prisma.sql`TRUE`];
  for (const [key, column] of [['tenantId', 'tenantId'], ['companyId', 'companyId'], ['branchId', 'branchId'], ['status', 'status'], ['priority', 'priority'], ['assignedToId', 'assignedToId'], ['escalationStatus', 'escalationStatus']] as const) {
    if (q[key]) parts.push(Prisma.sql`${Prisma.raw(`t."${column}"`)}=${q[key]}`);
  }
  if (q.view === 'MINE') parts.push(Prisma.sql`t."assignedToId"=${actorId}`);
  if (q.view === 'UNASSIGNED') parts.push(Prisma.sql`t."assignedToId" IS NULL`);
  if (q.unread === 'true') parts.push(unreadSql(actorId));
  if (q.slaState) parts.push(Prisma.sql`(${slaSql})=${q.slaState}`);
  if (q.search) {
    const term = `%${q.search}%`;
    parts.push(Prisma.sql`(t.subject ILIKE ${term} OR t.category ILIKE ${term}
      OR EXISTS(SELECT 1 FROM "Tenant" x WHERE x.id=t."tenantId" AND x.name ILIKE ${term})
      OR EXISTS(SELECT 1 FROM "Company" x WHERE x.id=t."companyId" AND x.name ILIKE ${term})
      OR EXISTS(SELECT 1 FROM "User" x WHERE x.id=t."createdById" AND x.name ILIKE ${term}))`);
  }
  for (const [from, to, column] of [[q.createdFrom, q.createdTo, 'createdAt'], [q.updatedFrom, q.updatedTo, 'updatedAt']] as const) {
    const dayOnlyEnd = !!to && /^\d{4}-\d{2}-\d{2}$/.test(to);
    if (from && to) {
      const inclusiveEnd = new Date(to);
      if (dayOnlyEnd) inclusiveEnd.setUTCDate(inclusiveEnd.getUTCDate() + 1);
      if (dayOnlyEnd ? new Date(from) >= inclusiveEnd : new Date(from) > inclusiveEnd) throw new BadRequestException('Date range is reversed');
    }
    if (from) parts.push(Prisma.sql`${Prisma.raw(`t."${column}"`)}>=${new Date(from)}`);
    if (to) {
      const end = new Date(to);
      if (/^\d{4}-\d{2}-\d{2}$/.test(to)) { end.setUTCDate(end.getUTCDate() + 1); parts.push(Prisma.sql`${Prisma.raw(`t."${column}"`)}<${end}`); }
      else parts.push(Prisma.sql`${Prisma.raw(`t."${column}"`)}<=${end}`);
    }
  }
  return Prisma.sql`${Prisma.join(parts, ' AND ')}`;
}
