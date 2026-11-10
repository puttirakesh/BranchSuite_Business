import { ticketWhere } from '../../support/support-query';
import { SupportOperations } from '../../support/support-operations.service';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { notify } from '../../../common/notifications';
import { AuthenticatedPlatformUser } from '../auth/guards/platform-jwt.guard';
import { SupportPresenter, platformTicketDetailInclude, platformTicketListInclude } from '../../support/support-presenter.service';
import { INTERNAL_AUDIT_MODULE, OPEN_STATUSES, assertTransition, replyOutcome } from '../../support/support-policy';
import { CreatePlatformTicketReplyDto, ListPlatformTicketsDto, UpdatePlatformTicketPriorityDto, UpdatePlatformTicketStatusDto } from './dto/support.dto';

type TicketScope = { id: string; tenantId: string; companyId: string; branchId: string | null; createdById: string; subject: string };

@Injectable()
export class PlatformSupportService {
  constructor(private readonly prisma: PrismaService, private readonly presenter: SupportPresenter, private readonly operations: SupportOperations) {}

  async summary(actor?: AuthenticatedPlatformUser) {
    const [total, byStatus, byPriority] = await Promise.all([
      this.prisma.supportTicket.count(),
      this.prisma.supportTicket.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.supportTicket.groupBy({ by: ['priority'], _count: { _all: true } }),
    ]);
    const statusCounts = Object.fromEntries(byStatus.map(row => [row.status, row._count._all]));
    return {
      ...(await this.operations.analytics(actor?.id ?? '')),
      total,
      // Canonical definition shared with the Admin dashboard: OPEN + IN_PROGRESS.
      open: OPEN_STATUSES.reduce((sum, status) => sum + (statusCounts[status] ?? 0), 0),
      byStatus: statusCounts,
      byPriority: Object.fromEntries(byPriority.map(row => [row.priority, row._count._all])),
    };
  }

  async list(query: ListPlatformTicketsDto, actor?: AuthenticatedPlatformUser) {
    const page = query.page ?? 1, limit = query.limit ?? 20;
    const actorId = actor?.id ?? '';
    const where = ticketWhere(query, actorId);
    const [counts, selected] = await this.prisma.$transaction([
      this.prisma.$queryRaw<{ total: number }[]>(Prisma.sql`SELECT COUNT(*)::int AS total FROM "SupportTicket" t WHERE ${where}`),
      this.prisma.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT t.id FROM "SupportTicket" t WHERE ${where} ORDER BY t."updatedAt" DESC,t.id DESC LIMIT ${limit} OFFSET ${(page-1)*limit}`),
    ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    const directoryScope = query.tenantId ? { tenantId: query.tenantId } : {};
    const [rows, companies, branches] = await Promise.all([
      this.prisma.supportTicket.findMany({ where: { id: { in: selected.map(x => x.id) } }, include: { ...platformTicketListInclude, readStates: { where: { platformUserId: actorId } } } }),
      this.prisma.company.findMany({ where: { supportTickets: { some: directoryScope } }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      this.prisma.branch.findMany({ where: { supportTickets: { some: directoryScope } }, select: { id: true, name: true, companyId: true }, orderBy: { name: 'asc' } }),
    ]);
    const byId = new Map(rows.map(row => [row.id, row]));
    return { items: selected.filter(x => byId.has(x.id)).map(x => this.presentUnread(this.presenter.platformSummary(byId.get(x.id)), byId.get(x.id))), total: counts[0].total, page, limit, totalPages: Math.ceil(counts[0].total/limit), filters: { companies, branches } };
  }

  private presentUnread(view: any, row: any) {
    const { readStates, ...safe } = view;
    return { ...safe, unread: (row.readStates?.[0]?.lastReadCustomerVersion ?? 0) < row.customerActivityVersion };
  }

  async detail(id: string, actor?: AuthenticatedPlatformUser) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id }, include: { ...platformTicketDetailInclude, readStates: { where: { platformUserId: actor?.id ?? '' } } } });
    if (!ticket) throw new NotFoundException('Support ticket not found');
    return this.presentUnread(await this.presenter.platformDetail(ticket), ticket);
  }

  private async audit(tx: Prisma.TransactionClient, ticket: TicketScope, actor: AuthenticatedPlatformUser, action: string, detail: string, changes: Prisma.InputJsonValue, module = 'PLATFORM_SUPPORT') {
    await tx.auditEvent.create({ data: {
      tenantId: ticket.tenantId, companyId: ticket.companyId, branchId: ticket.branchId,
      actorId: actor.id, action, module, targetId: ticket.id,
      detail: detail.slice(0, 500), changes,
    } });
  }

  private notifyRequester(tx: Prisma.TransactionClient, ticket: TicketScope, title: string, message: string) {
    return notify(tx, ticket.tenantId, ticket.companyId, ticket.createdById, title.slice(0, 180), message.slice(0, 500), `/employee/help?ticketId=${encodeURIComponent(ticket.id)}`);
  }

  async updateStatus(id: string, dto: UpdatePlatformTicketStatusDto, actor: AuthenticatedPlatformUser) {
    const updated = await this.prisma.$transaction(async tx => {
      const existing = await tx.supportTicket.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException('Support ticket not found');
      if (dto.expectedStatus && dto.expectedStatus !== existing.status) throw new ConflictException('Ticket was modified; retry with fresh details');
      if (existing.status === dto.status) return existing;
      assertTransition(existing.status, dto.status);
      const result = await tx.supportTicket.updateMany({ where: { id, status: existing.status }, data: { status: dto.status, ...(['RESOLVED','CLOSED'].includes(dto.status) && !existing.resolvedAt ? { resolvedAt: new Date() } : {}) } });
      if (!result.count) throw new ConflictException('Ticket was modified; retry with fresh details');
      await this.audit(tx, existing, actor, 'TICKET_STATUS_CHANGED', `${existing.status} -> ${dto.status}`, { from: existing.status, to: dto.status });
      await this.notifyRequester(tx, existing, 'Support request updated', `"${existing.subject}" is now ${dto.status.replace('_', ' ').toLowerCase()}.`);
      return tx.supportTicket.findUniqueOrThrow({ where: { id } });
    });
    return this.detail(updated.id);
  }

  async updatePriority(id: string, dto: UpdatePlatformTicketPriorityDto, actor: AuthenticatedPlatformUser) {
    const updated = await this.prisma.$transaction(async tx => {
      const existing = await tx.supportTicket.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException('Support ticket not found');
      if (dto.expectedPriority && dto.expectedPriority !== existing.priority) throw new ConflictException('Ticket was modified; retry with fresh details');
      if (existing.priority === dto.priority) return existing;
      const result = await tx.supportTicket.updateMany({ where: { id, priority: existing.priority }, data: { priority: dto.priority } });
      if (!result.count) throw new ConflictException('Ticket was modified; retry with fresh details');
      await this.audit(tx, existing, actor, 'TICKET_PRIORITY_CHANGED', `${existing.priority} -> ${dto.priority}`, { from: existing.priority, to: dto.priority });
      return tx.supportTicket.findUniqueOrThrow({ where: { id } });
    });
    return this.detail(updated.id);
  }

  async reply(id: string, dto: CreatePlatformTicketReplyDto, actor: AuthenticatedPlatformUser) {
    const visibility = dto.visibility ?? 'CUSTOMER';
    const internal = visibility === 'INTERNAL';
    return this.prisma.$transaction(async tx => {
      const existing = await tx.supportTicket.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException('Support ticket not found');
      const outcome = replyOutcome(existing.status);
      // Internal notes never change the customer-facing lifecycle, so they are allowed on any status.
      if (!internal && !outcome.allowed) throw new ConflictException('Reopen the ticket before replying');
      const message = await tx.supportTicketMessage.create({ data: {
        ticketId: existing.id, authorId: actor.id, platformAuthorId: actor.id,
        authorRole: actor.role, visibility, message: dto.message,
      } });
      if (internal) {
        // Content-free audit event in a module Business audit readers can never select.
        await this.audit(tx, existing, actor, 'TICKET_NOTE_ADDED', 'Internal note added', { messageId: message.id }, INTERNAL_AUDIT_MODULE);
        return { message: this.presenter.platformMessage({ ...message, platformAuthor: { id: actor.id, name: actor.name, role: actor.role } }), ticketId: id, reopened: false };
      }
      const reopened = outcome.reopens;
      const claimed = await tx.supportTicket.updateMany({ where: { id, status: existing.status }, data: { ...(reopened ? { status: 'OPEN' } : {}), updatedAt: new Date() } });
      if (!claimed.count) throw new ConflictException('Ticket was modified; retry with fresh details');
      await tx.supportTicket.updateMany({ where: { id, firstResponseAt: null }, data: { firstResponseAt: new Date() } });
      await this.audit(tx, existing, actor, 'TICKET_REPLIED', 'Platform support replied', { messageId: message.id, reopened });
      await this.notifyRequester(tx, existing, 'Support replied', `BranchSuite Support replied to "${existing.subject}".`);
      return { message: this.presenter.platformMessage({ ...message, platformAuthor: { id: actor.id, name: actor.name, role: actor.role } }), ticketId: id, reopened };
    });
  }
}
