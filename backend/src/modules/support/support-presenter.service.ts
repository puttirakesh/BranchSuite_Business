import { slaState } from './support-sla';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AuthorRole, INTERNAL_AUDIT_MODULE, PLATFORM_SUPPORT_LABEL, PUBLIC_AUDIT_ACTIONS, PUBLIC_AUDIT_MODULES, isPlatformRole,
} from './support-policy';

const authorInclude = {
  businessAuthor: { select: { id: true, name: true } },
  platformAuthor: { select: { id: true, name: true, role: true } },
} as const;

/** Include fragment for Business-facing reads: internal notes are excluded at the query level. */
export const businessTicketInclude = {
  messages: { where: { visibility: 'CUSTOMER' }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], include: authorInclude },
  company: { select: { id: true, name: true } },
  branch: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.SupportTicketInclude;

/** Platform detail include: all messages, internal notes included. Never import this from Business code. */
export const platformTicketDetailInclude = {
  assignedTo: { select: { id: true, name: true, status: true } },
  messages: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], include: authorInclude },
  tenant: { select: { id: true, name: true } },
  company: { select: { id: true, name: true } },
  branch: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.SupportTicketInclude;

export const platformTicketListInclude = {
  assignedTo: { select: { id: true, name: true, status: true } },
  _count: { select: { messages: true } },
  tenant: { select: { id: true, name: true } },
  company: { select: { id: true, name: true } },
  branch: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  messages: { where: { visibility: 'CUSTOMER' }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 1, select: { authorRole: true, createdAt: true } },
} satisfies Prisma.SupportTicketInclude;

export type MessageRow = {
  id: string; ticketId: string; authorId: string; authorRole: string; visibility: string; message: string; createdAt: Date;
  businessAuthor?: { id: string; name: string } | null;
  platformAuthor?: { id: string; name: string; role: string } | null;
};

type HistoryTicket = { id: string; tenantId: string; createdById: string };
type Named = { id: string; name: string };

@Injectable()
export class SupportPresenter {
  constructor(private readonly prisma: PrismaService) {}

  /** Business view of a message. Internal rows are dropped here as a second line of defence. */
  businessMessage(row: MessageRow) {
    if (row.visibility !== 'CUSTOMER') return null;
    const platform = isPlatformRole(row.authorRole);
    return {
      id: row.id, ticketId: row.ticketId, message: row.message, createdAt: row.createdAt,
      visibility: 'CUSTOMER' as const, authorRole: row.authorRole as AuthorRole,
      // Platform staff identities and ids are never disclosed to tenants.
      authorId: platform ? null : row.businessAuthor?.id ?? row.authorId,
      authorName: platform ? PLATFORM_SUPPORT_LABEL : row.businessAuthor?.name ?? 'Former team member',
    };
  }

  platformMessage(row: MessageRow) {
    return {
      id: row.id, ticketId: row.ticketId, message: row.message, createdAt: row.createdAt,
      visibility: row.visibility as 'CUSTOMER' | 'INTERNAL', authorRole: row.authorRole as AuthorRole,
      authorId: row.platformAuthor?.id ?? row.businessAuthor?.id ?? row.authorId,
      authorName: row.platformAuthor?.name ?? row.businessAuthor?.name ?? (isPlatformRole(row.authorRole) ? 'Former support agent' : 'Former team member'),
    };
  }

  async businessTickets(rows: Array<any>) {
    const history = await this.history(rows, false);
    return rows.map(row => this.businessTicket(row, history.get(row.id) ?? []));
  }

  businessTicket(row: any, history: unknown[]) {
    const { messages, createdBy, company, branch, ...ticket } = row as { messages: MessageRow[]; createdBy?: Named; company?: Named; branch?: Named | null } & Record<string, unknown>;
    return {
      id: ticket.id, tenantId: ticket.tenantId, companyId: ticket.companyId, branchId: ticket.branchId, createdById: ticket.createdById,
      subject: ticket.subject, category: ticket.category, status: ticket.status, priority: ticket.priority, createdAt: ticket.createdAt, updatedAt: ticket.updatedAt,
      assignedToSupport: !!ticket.assignedToId, escalationStage: ticket.escalationStatus ?? 'NONE',
      requester: createdBy ? { id: createdBy.id, name: createdBy.name } : null,
      company: company ?? null, branch: branch ?? null,
      messages: messages.map(message => this.businessMessage(message)).filter((message): message is NonNullable<typeof message> => message !== null),
      history,
    };
  }

  async businessTicketOne(row: any) {
    return (await this.businessTickets([row]))[0];
  }

  platformSummary(row: any) {
    const { _count, tenant, company, branch, createdBy, messages, ...ticket } = row;
    const last = messages?.[0] as { authorRole: string; createdAt: Date } | undefined;
    return {
      ...ticket,
      slaState: slaState(row),
      customerName: tenant?.name ?? null,
      tenant: tenant ?? null, company: company ?? null, branch: branch ?? null,
      requester: createdBy ? { id: createdBy.id, name: createdBy.name } : null,
      messageCount: _count?.messages ?? 0,
      lastCustomerMessage: last ? { authorRole: last.authorRole, createdAt: last.createdAt } : null,
      awaitingSupport: ['OPEN', 'IN_PROGRESS'].includes(ticket.status) && (!last || !isPlatformRole(last.authorRole)),
    };
  }

  async platformDetail(row: any) {
    const { tenant, company, branch, createdBy, messages, ...ticket } = row;
    const history = await this.history([row], true);
    return {
      ...ticket,
      slaState: slaState(row),
      customerName: tenant?.name ?? null,
      tenant, company, branch: branch ?? null,
      requester: createdBy ? { id: createdBy.id, name: createdBy.name } : null,
      messages: (messages as MessageRow[]).map(message => this.platformMessage(message)),
      history: history.get(row.id) ?? [],
    };
  }

  /**
   * Ticket timeline assembled from existing AuditEvent rows. Business callers (includeInternal=false) only receive
   * whitelisted public actions; internal-note events live in a separate audit module and are never selected for them.
   */
  async history(tickets: HistoryTicket[], includeInternal: boolean) {
    const result = new Map<string, unknown[]>();
    if (!tickets.length) return result;
    const byId = new Map(tickets.map(ticket => [ticket.id, ticket]));
    const events = await this.prisma.auditEvent.findMany({
      where: {
        targetId: { in: tickets.map(ticket => ticket.id) },
        tenantId: { in: [...new Set(tickets.map(ticket => ticket.tenantId))] },
        module: { in: includeInternal ? [...PUBLIC_AUDIT_MODULES, INTERNAL_AUDIT_MODULE] : [...PUBLIC_AUDIT_MODULES] },
        ...(includeInternal ? {} : { action: { in: [...PUBLIC_AUDIT_ACTIONS] } }),
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 1000,
    });
    const actorIds = [...new Set(events.map(event => event.actorId))];
    const [people, staff] = await Promise.all([
      actorIds.length ? this.prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } }) : [],
      actorIds.length ? this.prisma.platformUser.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true, role: true } }) : [],
    ]);
    const personById = new Map(people.map(person => [person.id, person]));
    const staffById = new Map(staff.map(person => [person.id, person]));
    for (const event of events) {
      const ticket = byId.get(event.targetId);
      if (!ticket || event.tenantId !== ticket.tenantId) continue;
      // Defence in depth: the query already excludes these, but Business output must never carry them.
      if (!includeInternal && (event.module === INTERNAL_AUDIT_MODULE || !(PUBLIC_AUDIT_ACTIONS as readonly string[]).includes(event.action))) continue;
      // SUPPORT events come from Business actors; PLATFORM_* events from platform staff.
      const platformActor = event.module !== 'SUPPORT' ? staffById.get(event.actorId) : undefined;
      const businessActor = platformActor ? undefined : personById.get(event.actorId);
      const changes = (event.changes ?? {}) as { from?: string; to?: string; reason?: string };
      const item = {
        id: event.id, action: event.action, createdAt: event.createdAt,
        visibility: event.module === INTERNAL_AUDIT_MODULE ? 'INTERNAL' as const : 'CUSTOMER' as const,
        actorType: platformActor ? 'PLATFORM' as const : 'BUSINESS' as const,
        actorRole: (platformActor ? platformActor.role : event.actorId === ticket.createdById ? 'REQUESTER' : 'COMPANY_ADMIN') as AuthorRole,
        actorName: platformActor ? (includeInternal ? platformActor.name : PLATFORM_SUPPORT_LABEL) : businessActor?.name ?? 'Former team member',
        from: changes.from ?? null, to: changes.to ?? null,
        summary: summarize(event.action, changes),
      };
      const list = result.get(event.targetId) ?? [];
      list.push(item);
      result.set(event.targetId, list);
    }
    return result;
  }
}

function summarize(action: string, changes: { from?: string; to?: string; reason?: string }) {
  switch (action) {
    case 'TICKET_CREATED': return 'Ticket created';
    case 'TICKET_REPLIED': return 'Reply added';
    case 'TICKET_NOTE_ADDED': return 'Internal note added';
    case 'TICKET_STATUS_CHANGED': return `Status changed from ${changes.from ?? '?'} to ${changes.to ?? '?'}`;
    case 'TICKET_PRIORITY_CHANGED': return `Priority changed from ${changes.from ?? '?'} to ${changes.to ?? '?'}`;
    case 'TICKET_ASSIGNMENT_CHANGED': return changes.to ? (changes.from ? 'Ticket reassigned to Support' : 'Ticket assigned to Support') : 'Ticket unassigned';
    case 'TICKET_ESCALATION_REQUESTED': return `Escalation requested: ${changes.reason ?? 'Reason unavailable'}`;
    case 'TICKET_ESCALATION_CHANGED': return `Escalation ${changes.to?.toLowerCase() ?? 'updated'}${changes.reason ? ': ' + changes.reason : ''}`;
    default: return action;
  }
}
