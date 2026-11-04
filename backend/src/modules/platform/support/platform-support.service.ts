import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthenticatedPlatformUser } from '../auth/guards/platform-jwt.guard';
import { CreatePlatformTicketReplyDto, ListPlatformTicketsDto, UpdatePlatformTicketPriorityDto, UpdatePlatformTicketStatusDto } from './dto/support.dto';

const summarySelect = {
  id: true, tenantId: true, companyId: true, branchId: true, createdById: true,
  subject: true, category: true, status: true, priority: true, createdAt: true, updatedAt: true,
  _count: { select: { messages: true } },
} as const;

@Injectable()
export class PlatformSupportService {
  constructor(private readonly prisma: PrismaService) {}

  async summary() {
    const [total, byStatus, byPriority] = await Promise.all([
      this.prisma.supportTicket.count(),
      this.prisma.supportTicket.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.supportTicket.groupBy({ by: ['priority'], _count: { _all: true } }),
    ]);
    return {
      total,
      byStatus: Object.fromEntries(byStatus.map(row => [row.status, row._count._all])),
      byPriority: Object.fromEntries(byPriority.map(row => [row.priority, row._count._all])),
    };
  }

  async list(query: ListPlatformTicketsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.SupportTicketWhereInput = {
      ...(query.tenantId ? { tenantId: query.tenantId } : {}),
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.search ? { OR: [
        { subject: { contains: query.search, mode: 'insensitive' } },
        { category: { contains: query.search, mode: 'insensitive' } },
      ] } : {}),
    };
    const [total, items] = await Promise.all([
      this.prisma.supportTicket.count({ where }),
      this.prisma.supportTicket.findMany({
        where, select: summarySelect,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit, take: limit,
      }),
    ]);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async detail(id: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id }, include: { messages: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] } },
    });
    if (!ticket) throw new NotFoundException('Support ticket not found');
    return ticket;
  }

  private async audit(tx: Prisma.TransactionClient, ticket: { id: string; tenantId: string; companyId: string; branchId: string | null }, actor: AuthenticatedPlatformUser, action: string, detail: string, changes: Prisma.InputJsonValue) {
    await tx.auditEvent.create({ data: {
      tenantId: ticket.tenantId, companyId: ticket.companyId, branchId: ticket.branchId,
      actorId: actor.id, action, module: 'PLATFORM_SUPPORT', targetId: ticket.id,
      detail: detail.slice(0, 500), changes,
    } });
  }

  async updateStatus(id: string, dto: UpdatePlatformTicketStatusDto, actor: AuthenticatedPlatformUser) {
    return this.prisma.$transaction(async tx => {
      const existing = await tx.supportTicket.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException('Support ticket not found');
      if (existing.status === dto.status) return existing;
      const updatedCount = await tx.supportTicket.updateMany({ where: { id, status: existing.status }, data: { status: dto.status } });
      if (!updatedCount.count) throw new ConflictException('Ticket was modified; retry with fresh details');
      await this.audit(tx, existing, actor, 'TICKET_STATUS_CHANGED', `${existing.status} -> ${dto.status}`, { from: existing.status, to: dto.status });
      return tx.supportTicket.findUniqueOrThrow({ where: { id } });
    });
  }

  async updatePriority(id: string, dto: UpdatePlatformTicketPriorityDto, actor: AuthenticatedPlatformUser) {
    return this.prisma.$transaction(async tx => {
      const existing = await tx.supportTicket.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException('Support ticket not found');
      if (existing.priority === dto.priority) return existing;
      const updatedCount = await tx.supportTicket.updateMany({ where: { id, priority: existing.priority }, data: { priority: dto.priority } });
      if (!updatedCount.count) throw new ConflictException('Ticket was modified; retry with fresh details');
      await this.audit(tx, existing, actor, 'TICKET_PRIORITY_CHANGED', `${existing.priority} -> ${dto.priority}`, { from: existing.priority, to: dto.priority });
      return tx.supportTicket.findUniqueOrThrow({ where: { id } });
    });
  }

  async reply(id: string, dto: CreatePlatformTicketReplyDto, actor: AuthenticatedPlatformUser) {
    return this.prisma.$transaction(async tx => {
      const existing = await tx.supportTicket.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException('Support ticket not found');
      if (existing.status === 'CLOSED') throw new ConflictException('Reopen the ticket before replying');
      // Use platform user ID as authorId. The current schema intentionally has no FK on authorId.
      const message = await tx.supportTicketMessage.create({ data: {
        ticketId: existing.id, authorId: actor.id, message: dto.message,
      } });
      // Keep the ticket visible in a work queue and reopen resolved tickets on a new reply.
      await tx.supportTicket.update({ where: { id }, data: existing.status === 'RESOLVED' ? { status: 'OPEN' } : { updatedAt: new Date() } });
      await this.audit(tx, existing, actor, 'TICKET_REPLIED', 'Platform support replied', { messageId: message.id });
      return { message, ticketId: id, reopened: existing.status === 'RESOLVED' };
    });
  }
}
