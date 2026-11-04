export const TICKET_STATUSES = ['Open', 'In progress', 'Resolved', 'Closed'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];
export const TICKET_PRIORITIES = ['Low', 'Normal', 'High', 'Urgent'] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export interface TicketMessage {
  id: string;
  by: string;
  text: string;
  internal: boolean;
  time: string;
}

export interface Ticket {
  id: string;
  customerId: string | null;
  customerName: string | null;
  subject: string;
  category: string;
  status: TicketStatus;
  priority: TicketPriority;
  createdOn: string;
  messages: TicketMessage[];
}
