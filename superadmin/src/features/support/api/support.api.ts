import { endpoints, pendingEndpoints } from '../../../core/api/endpoints';
import { http } from '../../../core/api/client';
import { AppError, pendingIntegration } from '../../../core/api/api-error';
import { dateOnly, shortId } from '../../../core/api/mappers';
import { matches, pageOf, type ListQuery, type Page } from '../../../core/api/types';
import { run } from '../../../core/data/source';
import { previewAudit, previewDb, previewId } from '../../../core/data/previewStore';
import { today } from '../../../core/domain/dates';
import type { Ticket, TicketPriority, TicketStatus } from '../types';

const statusToApi: Record<TicketStatus, string> = { Open: 'OPEN', 'In progress': 'IN_PROGRESS', Resolved: 'RESOLVED', Closed: 'CLOSED' };
const statusFromApi: Record<string, TicketStatus> = { OPEN: 'Open', IN_PROGRESS: 'In progress', RESOLVED: 'Resolved', CLOSED: 'Closed' };
const priorityFromApi: Record<string, TicketPriority> = { LOW: 'Low', NORMAL: 'Normal', HIGH: 'High', URGENT: 'Urgent' };

/** backend/src/modules/platform/support/platform-support.service.ts */
interface BackendTicket {
  id: string;
  tenantId: string | null;
  subject: string;
  category: string;
  status: string;
  priority: string;
  createdAt: string;
  messages?: { id: string; authorId: string; message: string; createdAt: string }[];
}

function mapTicket(raw: BackendTicket): Ticket {
  return {
    id: raw.id,
    customerId: raw.tenantId,
    customerName: null,
    subject: raw.subject,
    category: raw.category,
    status: statusFromApi[raw.status] ?? 'Open',
    priority: priorityFromApi[raw.priority] ?? 'Normal',
    createdOn: dateOnly(raw.createdAt) ?? '',
    // The backend stores only authorId; names need a join that does not exist yet.
    messages: (raw.messages ?? []).map((m) => ({
      id: m.id,
      by: 'User ' + shortId(m.authorId),
      text: m.message,
      internal: false,
      time: dateOnly(m.createdAt) ?? '',
    })),
  };
}

export interface TicketQuery extends ListQuery {
  status?: TicketStatus;
  customerId?: string;
}

const find = (id: string) => {
  const t = previewDb().tickets.find((x) => x.id === id);
  if (!t) throw new AppError('not_found', 'This ticket no longer exists.');
  return t;
};
const ticketPath = (id: string) => endpoints.support.ticket(id);

export const supportApi = {
  list: (query: TicketQuery) =>
    run<Page<Ticket>>({
      preview: () =>
        pageOf(
          previewDb().tickets.filter(
            (t) =>
              (!query.status || t.status === query.status) &&
              (!query.customerId || t.customerId === query.customerId) &&
              matches(query.search, t.subject, t.status, t.customerName, t.category),
          ),
          query,
        ),
      api: async () => {
        const res = await http.get<Page<BackendTicket>>(endpoints.support.tickets, {
          search: query.search || undefined,
          status: query.status ? statusToApi[query.status] : undefined,
          tenantId: query.customerId,
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
        // The reply DTO has no visibility flag, so internal notes would reach the customer.
        if (internal) throw pendingIntegration(pendingEndpoints.internalNote);
        await http.post(ticketPath(id) + '/replies', { message: message.trim() });
      },
    }),

  setStatus: (id: string, status: TicketStatus) =>
    run<void>({
      preview: () => {
        find(id).status = status;
      },
      api: async () => {
        await http.patch(ticketPath(id) + '/status', { status: statusToApi[status] });
      },
    }),

  setPriority: (id: string, priority: TicketPriority) =>
    run<void>({
      preview: () => {
        find(id).priority = priority;
      },
      api: async () => {
        await http.patch(ticketPath(id) + '/priority', { priority: priority.toUpperCase() });
      },
    }),
};
