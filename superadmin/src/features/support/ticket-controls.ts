import { TICKET_STATUSES, type TicketStatus } from './types';

/** Mirrors the existing backend lifecycle; the current value stays selectable. */
export function allowedTicketStatuses(current: TicketStatus): TicketStatus[] {
  return current === 'Closed' ? ['Closed', 'Open'] : [...TICKET_STATUSES];
}

export function canSubmitTicketMessage(status: TicketStatus, internal: boolean, canNote: boolean): boolean {
  return internal ? canNote : status !== 'Closed';
}
