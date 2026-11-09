import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedPlatformUser } from '../platform/auth/guards/platform-jwt.guard';
import { AssignSupportDto, EscalateSupportDto, ManageEscalationDto, ReadSupportDto, SupportBusinessesDto } from '../platform/support/dto/support.dto';
import { INTERNAL_AUDIT_MODULE } from './support-policy';
import { slaSql, unreadSql } from './support-query';

@Injectable()
export class SupportOperations {
  constructor(private readonly prisma: PrismaService) {}

  agents() { return this.prisma.platformUser.findMany({ where: { status: 'ACTIVE', role: 'PLATFORM_SUPPORT' }, select: { id: true, name: true }, orderBy: [{ name: 'asc' }, { id: 'asc' }] }); }

  private async ticket(tx: Prisma.TransactionClient, id: string) {
    const ticket = await tx.supportTicket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException('Support ticket not found');
    return ticket;
  }

  private async change(tx: Prisma.TransactionClient, ticket: Awaited<ReturnType<SupportOperations['ticket']>>, revision: number, data: Prisma.SupportTicketUncheckedUpdateManyInput, actor: AuthenticatedPlatformUser, action: string, changes: Prisma.InputJsonValue) {
    const result = await tx.supportTicket.updateMany({ where: { id: ticket.id, supportRevision: revision }, data: { ...data, supportRevision: { increment: 1 } } });
    if (!result.count) throw new ConflictException('Ticket changed. Refresh and retry.');
    await tx.auditEvent.create({ data: { tenantId: ticket.tenantId, companyId: ticket.companyId, branchId: ticket.branchId, targetId: ticket.id,
      actorId: actor.id, module: INTERNAL_AUDIT_MODULE, action, detail: action.replaceAll('_', ' ').slice(0, 500), changes } });
    return { id: ticket.id };
  }

  assign(id: string, dto: AssignSupportDto, actor: AuthenticatedPlatformUser, claim = false) {
    if (claim ? actor.role !== 'PLATFORM_SUPPORT' : actor.role !== 'PLATFORM_ADMIN') throw new ForbiddenException('Assignment action not allowed');
    return this.prisma.$transaction(async tx => {
      const ticket = await this.ticket(tx, id);
      if (ticket.supportRevision !== dto.expectedRevision || (claim && ticket.assignedToId)) throw new ConflictException('Ticket assignment changed. Refresh and retry.');
      const agentId = claim ? actor.id : dto.agentId;
      if (agentId) {
        // Lock the eligible agent until assignment commits; concurrent deactivation must wait.
        const eligible = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "PlatformUser" WHERE id=${agentId} AND status='ACTIVE' AND role='PLATFORM_SUPPORT' FOR SHARE`;
        if (!eligible.length) throw new BadRequestException('Choose an active Support agent');
      }
      if (ticket.assignedToId === agentId) return { id };
      return this.change(tx, ticket, dto.expectedRevision, { assignedToId: agentId, assignedAt: agentId ? new Date() : null }, actor, 'TICKET_ASSIGNMENT_CHANGED', { from: ticket.assignedToId, to: agentId, claimed: claim });
    });
  }

  escalate(id: string, dto: EscalateSupportDto, actor: AuthenticatedPlatformUser) {
    return this.prisma.$transaction(async tx => {
      const ticket = await this.ticket(tx, id);
      if (['REQUESTED','ACKNOWLEDGED'].includes(ticket.escalationStatus)) throw new ConflictException('Escalation is already active');
      return this.change(tx, ticket, dto.expectedRevision, { escalationStatus: 'REQUESTED', escalationReason: dto.reason, escalatedAt: new Date(), escalatedById: actor.id }, actor, 'TICKET_ESCALATION_REQUESTED', { reason: dto.reason, from: ticket.escalationStatus, to: 'REQUESTED' });
    });
  }

  manageEscalation(id: string, dto: ManageEscalationDto, actor: AuthenticatedPlatformUser) {
    if (actor.role !== 'PLATFORM_ADMIN') throw new ForbiddenException('Platform Admin required');
    return this.prisma.$transaction(async tx => {
      const ticket = await this.ticket(tx, id);
      if (!['REQUESTED','ACKNOWLEDGED'].includes(ticket.escalationStatus) || (dto.status === 'ACKNOWLEDGED' && ticket.escalationStatus !== 'REQUESTED')) throw new ConflictException('Invalid escalation transition');
      return this.change(tx, ticket, dto.expectedRevision, { escalationStatus: dto.status }, actor, 'TICKET_ESCALATION_CHANGED', { from: ticket.escalationStatus, to: dto.status, reason: dto.reason ?? null });
    });
  }

  markRead(id: string, dto: ReadSupportDto, actor: AuthenticatedPlatformUser) {
    return this.prisma.$transaction(async tx => {
      const ticket = await this.ticket(tx, id);
      if (dto.customerActivityVersion > ticket.customerActivityVersion) throw new BadRequestException('Cannot acknowledge unseen activity');
      await tx.$executeRaw`INSERT INTO "SupportTicketReadState" ("ticketId","platformUserId","lastReadCustomerVersion","readAt")
        VALUES (${id},${actor.id},${dto.customerActivityVersion},CURRENT_TIMESTAMP)
        ON CONFLICT ("ticketId","platformUserId") DO UPDATE SET "lastReadCustomerVersion"=GREATEST("SupportTicketReadState"."lastReadCustomerVersion",EXCLUDED."lastReadCustomerVersion"), "readAt"=CURRENT_TIMESTAMP`;
      return { acknowledgedVersion: dto.customerActivityVersion };
    });
  }

  async analytics(actorId: string) {
    const [totals, trend, workload] = await Promise.all([
      this.prisma.$queryRaw<Record<string, number | null>[]>(Prisma.sql`SELECT
        COUNT(*) FILTER(WHERE t."assignedToId" IS NULL)::int AS unassigned,
        COUNT(*) FILTER(WHERE t."assignedToId" IS NOT NULL)::int AS assigned,
        COUNT(*) FILTER(WHERE (${slaSql})='OVERDUE')::int AS overdue,
        COUNT(*) FILTER(WHERE t."escalationStatus" IN ('REQUESTED','ACKNOWLEDGED'))::int AS escalated,
        COUNT(*) FILTER(WHERE ${unreadSql(actorId)})::int AS unread,
        AVG(EXTRACT(EPOCH FROM(t."firstResponseAt"-t."createdAt"))*1000)::double precision AS "averageFirstResponseMs",
        AVG(EXTRACT(EPOCH FROM(t."resolvedAt"-t."createdAt"))*1000)::double precision AS "averageResolutionMs"
        FROM "SupportTicket" t`),
      this.prisma.$queryRaw(Prisma.sql`SELECT to_char(day AT TIME ZONE 'UTC','YYYY-MM-DD') AS day,
        (SELECT count(*)::int FROM "SupportTicket" t WHERE t."createdAt">=day AND t."createdAt"<day+INTERVAL '1 day') AS created,
        (SELECT count(*)::int FROM "SupportTicketMessage" m WHERE m.visibility='CUSTOMER' AND m."createdAt">=day AND m."createdAt"<day+INTERVAL '1 day') AS "publicMessages"
        FROM generate_series(date_trunc('day',CURRENT_TIMESTAMP AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'-INTERVAL '13 days',date_trunc('day',CURRENT_TIMESTAMP AT TIME ZONE 'UTC') AT TIME ZONE 'UTC',INTERVAL '1 day') day ORDER BY day`),
      this.prisma.$queryRaw(Prisma.sql`SELECT p.id,p.name,p.status,COUNT(t.id)::int AS assigned,COUNT(t.id) FILTER(WHERE t.status IN ('OPEN','IN_PROGRESS'))::int AS open
        FROM "PlatformUser" p LEFT JOIN "SupportTicket" t ON t."assignedToId"=p.id WHERE p.role='PLATFORM_SUPPORT' GROUP BY p.id,p.name,p.status ORDER BY p.name,p.id`),
    ]);
    return { ...totals[0], trend, workload };
  }

  async businesses(q: SupportBusinessesDto) {
    const term = `%${q.search ?? ''}%`;
    const clauses = [Prisma.sql`(c.name ILIKE ${term} OR n.name ILIKE ${term})`];
    if (q.tenantId) clauses.push(Prisma.sql`t."tenantId"=${q.tenantId}`);
    const having = q.openOnly === 'true' ? Prisma.sql`HAVING COUNT(*) FILTER(WHERE t.status IN ('OPEN','IN_PROGRESS'))>0` : Prisma.empty;
    const grouped = Prisma.sql`SELECT c.id,c.name AS "companyName",n.id AS "tenantId",n.name AS "businessName",COUNT(*)::int AS "ticketCount",COUNT(*) FILTER(WHERE t.status IN ('OPEN','IN_PROGRESS'))::int AS "openTicketCount",MAX(t."updatedAt") AS "latestActivity"
      FROM "SupportTicket" t JOIN "Company" c ON c.id=t."companyId" JOIN "Tenant" n ON n.id=t."tenantId" WHERE ${Prisma.join(clauses,' AND ')} GROUP BY c.id,c.name,n.id,n.name ${having}`;
    const order = q.sort === 'NAME' ? Prisma.sql`"businessName", "companyName",id` : q.sort === 'OPEN' ? Prisma.sql`"openTicketCount" DESC,"latestActivity" DESC,id` : Prisma.sql`"latestActivity" DESC,id`;
    const page = q.page ?? 1, limit = q.limit ?? 20;
    const [counts, items] = await this.prisma.$transaction([
      this.prisma.$queryRaw<{ total: number }[]>(Prisma.sql`SELECT COUNT(*)::int AS total FROM (${grouped}) directory`),
      this.prisma.$queryRaw(Prisma.sql`SELECT * FROM (${grouped}) directory ORDER BY ${order} LIMIT ${limit} OFFSET ${(page-1)*limit}`),
    ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    return { items, total: counts[0].total, page, limit, totalPages: Math.ceil(counts[0].total/limit) };
  }

  async businessDetail(companyId: string) {
    const company = await this.prisma.company.findFirst({ where: { id: companyId, supportTickets: { some: {} } }, select: { id: true, name: true, tenant: { select: { id: true, name: true } } } });
    if (!company) throw new NotFoundException('Ticket-associated business not found');
    const [branches, requesters] = await Promise.all([
      this.prisma.branch.findMany({ where: { companyId, supportTickets: { some: {} } }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      this.prisma.user.findMany({ where: { supportTicketsCreated: { some: { companyId } } }, select: { name: true }, orderBy: { name: 'asc' }, take: 100 }),
    ]);
    return { company, branches, requesters, requesterLimit: 100 };
  }
}
