export const TICKET_STATUSES = ['Open', 'In progress', 'Resolved', 'Closed'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];
export const TICKET_PRIORITIES = ['Low', 'Normal', 'High', 'Urgent'] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

/** Mirrors backend AUTHOR_ROLES (backend/src/modules/support/support-policy.ts). */
export type AuthorRole = 'REQUESTER' | 'COMPANY_ADMIN' | 'PLATFORM_SUPPORT' | 'PLATFORM_ADMIN';
export const AUTHOR_ROLE_LABELS: Record<AuthorRole, string> = {
  REQUESTER: 'Requester',
  COMPANY_ADMIN: 'Company admin',
  PLATFORM_SUPPORT: 'Platform support',
  PLATFORM_ADMIN: 'Platform admin',
};

export interface TicketMessage {
  id: string;
  by: string;
  text: string;
  internal: boolean;
  time: string;
  /** Present for API data; derived server-side, never inferred from ids. */
  authorRole?: AuthorRole;
}

export interface TicketHistoryItem {
  id: string;
  summary: string;
  actorName: string;
  actorRole: AuthorRole;
  internal: boolean;
  time: string;
}

export interface Ticket {
  assignedToId?: string | null;
  assignedTo?: { id: string; name: string; status?: string } | null;
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
  customerId: string | null;
  customerName: string | null;
  subject: string;
  category: string;
  status: TicketStatus;
  priority: TicketPriority;
  createdOn: string;
  messages: TicketMessage[];
  /** Ticket-bound context from the backend (no broad Customer directory access needed). */
  companyId?: string | null;
  branchId?: string | null;
  company?: string | null;
  branch?: string | null;
  requester?: string | null;
  awaitingSupport?: boolean;
  history?: TicketHistoryItem[];
}
