import { endpoints } from '../../../core/api/endpoints';
import { http } from '../../../core/api/client';
import { AppError } from '../../../core/api/api-error';
import { dateOnly } from '../../../core/api/mappers';
import { matches, pageOf, type ListQuery, type Page } from '../../../core/api/types';
import { run } from '../../../core/data/source';
import { previewAudit, previewDb, previewId } from '../../../core/data/previewStore';
import { today } from '../../../core/domain/dates';
import type { AuthorRole, Ticket, TicketPriority, TicketStatus } from '../types';

const statusToApi: Record<TicketStatus, string> = { Open: 'OPEN', 'In progress': 'IN_PROGRESS', Resolved: 'RESOLVED', Closed: 'CLOSED' };
const statusFromApi: Record<string, TicketStatus> = { OPEN: 'Open', IN_PROGRESS: 'In progress', RESOLVED: 'Resolved', CLOSED: 'Closed' };
const priorityFromApi: Record<string, TicketPriority> = { LOW: 'Low', NORMAL: 'Normal', HIGH: 'High', URGENT: 'Urgent' };

/** backend/src/modules/platform/support/platform-support.service.ts */
interface BackendTicket {
  assignedToId?: string | null;
  assignedTo?: Ticket['assignedTo'];
  supportRevision?: number;
  customerActivityVersion?: number;
  unread?: boolean;
  slaState?: string;
  responseDueAt?: string | null;
  resolutionDueAt?: string | null;
  firstResponseAt?: string | null;
  resolvedAt?: string | null;
  escalationStatus?: string;
  escalationReason?: string | null;
  escalatedAt?: string | null;
  id: string;
  tenantId: string | null;
  customerName?: string | null;
  tenant?: { id: string; name: string } | null;
  company?: { id: string; name: string } | null;
  branch?: { id: string; name: string } | null;
  requester?: { id: string; name: string } | null;
  awaitingSupport?: boolean;
  subject: string;
  category: string;
  status: string;
  priority: string;
  createdAt: string;
  messages?: { id: string; authorName: string; authorRole: AuthorRole; visibility: 'CUSTOMER' | 'INTERNAL'; message: string; createdAt: string }[];
  history?: { id: string; summary: string; actorName: string; actorRole: AuthorRole; visibility: 'CUSTOMER' | 'INTERNAL'; createdAt: string }[];
}

/** Full local date and time for conversation entries (date-only values hid ordering within a day). */
const stamp = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? (dateOnly(value) ?? '') : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
};

export function mapTicket(raw: BackendTicket): Ticket {
  return {
    assignedToId: raw.assignedToId, assignedTo: raw.assignedTo, supportRevision: raw.supportRevision,
    customerActivityVersion: raw.customerActivityVersion, unread: raw.unread, slaState: raw.slaState,
    responseDueAt: raw.responseDueAt, resolutionDueAt: raw.resolutionDueAt, firstResponseAt: raw.firstResponseAt, resolvedAt: raw.resolvedAt,
    escalationStatus: raw.escalationStatus, escalationReason: raw.escalationReason, escalatedAt: raw.escalatedAt,
    id: raw.id,
    customerId: raw.tenantId,
    customerName: raw.customerName ?? raw.tenant?.name ?? null,
    companyId: raw.company?.id ?? null,
    branchId: raw.branch?.id ?? null,
    company: raw.company?.name ?? null,
    branch: raw.branch?.name ?? null,
    requester: raw.requester?.name ?? null,
    awaitingSupport: raw.awaitingSupport,
    subject: raw.subject,
    category: raw.category,
    status: statusFromApi[raw.status] ?? 'Open',
    priority: priorityFromApi[raw.priority] ?? 'Normal',
    createdOn: dateOnly(raw.createdAt) ?? '',
    messages: (raw.messages ?? []).map((m) => ({
      id: m.id,
      by: m.authorName,
      authorRole: m.authorRole,
      text: m.message,
      internal: m.visibility === 'INTERNAL',
      time: stamp(m.createdAt),
    })),
    history: (raw.history ?? []).map((h) => ({
      id: h.id, summary: h.summary, actorName: h.actorName, actorRole: h.actorRole,
      internal: h.visibility === 'INTERNAL', time: stamp(h.createdAt),
    })),
  };
}

export type TicketFilters = { companies: { id: string; name: string }[]; branches: { id: string; name: string; companyId: string }[] };
export type TicketPage = Page<Ticket> & { filters?: TicketFilters };
export interface TicketQuery extends ListQuery {
  view?: 'ALL' | 'MINE' | 'UNASSIGNED';
  assignedToId?: string;
  slaState?: string;
  escalationStatus?: string;
  unread?: 'true';
  createdFrom?: string; createdTo?: string; updatedFrom?: string; updatedTo?: string;
  status?: TicketStatus;
  customerId?: string;
  companyId?: string;
  branchId?: string;
  priority?: TicketPriority;
}

const find = (id: string) => {
  const t = previewDb().tickets.find((x) => x.id === id);
  if (!t) throw new AppError('not_found', 'This ticket no longer exists.');
  return t;
};
const ticketPath = (id: string) => endpoints.support.ticket(id);

export const supportApi = {
  list: (query: TicketQuery) =>
    run<TicketPage>({
      preview: () =>
        pageOf(
          previewDb().tickets.filter(
            (t) =>
              (!query.status || t.status === query.status) &&
              (!query.customerId || t.customerId === query.customerId) &&
              (!query.companyId || t.companyId === query.companyId) &&
              (!query.branchId || t.branchId === query.branchId) &&
              (!query.priority || t.priority === query.priority) &&
              matches(query.search, t.subject, t.status, t.customerName, t.category),
          ),
          query,
        ),
      api: async () => {
        const res = await http.get<Page<BackendTicket> & { filters?: TicketFilters }>(endpoints.support.tickets, {
          view: query.view, assignedToId: query.assignedToId, slaState: query.slaState, escalationStatus: query.escalationStatus, unread: query.unread,
          createdFrom: query.createdFrom || undefined, createdTo: query.createdTo || undefined, updatedFrom: query.updatedFrom || undefined, updatedTo: query.updatedTo || undefined,
          search: query.search || undefined,
          status: query.status ? statusToApi[query.status] : undefined,
          tenantId: query.customerId,
          companyId: query.companyId,
          branchId: query.branchId,
          priority: query.priority?.toUpperCase(),
          page: query.page ?? 1,
          limit: query.limit ?? 50,
        });
        return { ...res, items: res.items.map(mapTicket) };
      },
    }),

  get: (id: string) =>
    run<Ticket>({
      preview: () => structuredClone(find(id)),
      api: async () => mapTicket(await http.get<BackendTicket>(ticketPath(id))),
    }),

  reply: (id: string, message: string, internal: boolean, author: string) =>
    run<void>({
      preview: () => {
        const t = find(id);
        t.messages.push({ id: previewId('msg'), by: author, text: message.trim(), internal, time: today() });
        previewAudit(internal ? 'Internal support note saved' : 'Support reply saved', t.id);
      },
      api: async () => {
        // One endpoint, explicit visibility: INTERNAL notes are stored platform-only and never reach the customer.
        await http.post(ticketPath(id) + '/replies', { message: message.trim(), visibility: internal ? 'INTERNAL' : 'CUSTOMER' });
      },
    }),

  setStatus: (id: string, status: TicketStatus, expected?: TicketStatus) =>
    run<void>({
      preview: () => {
        find(id).status = status;
      },
      api: async () => {
        await http.patch(ticketPath(id) + '/status', { status: statusToApi[status], ...(expected ? { expectedStatus: statusToApi[expected] } : {}) });
      },
    }),

  setPriority: (id: string, priority: TicketPriority, expected?: TicketPriority) =>
    run<void>({
      preview: () => {
        find(id).priority = priority;
      },
      api: async () => {
        await http.patch(ticketPath(id) + '/priority', { priority: priority.toUpperCase(), ...(expected ? { expectedPriority: expected.toUpperCase() } : {}) });
      },
    }),
};
