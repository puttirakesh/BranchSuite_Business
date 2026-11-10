import { BadRequestException } from '@nestjs/common';

// Single source of truth for the support contract shared by the Business and Platform modules.
export const TICKET_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;
export const TICKET_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;
export const MESSAGE_VISIBILITIES = ['CUSTOMER', 'INTERNAL'] as const;
export const AUTHOR_ROLES = ['REQUESTER', 'COMPANY_ADMIN', 'PLATFORM_SUPPORT', 'PLATFORM_ADMIN'] as const;
export const TICKET_CATEGORIES = ['ACCOUNT', 'PAYROLL', 'ATTENDANCE', 'CRM', 'OTHER'] as const;

export type TicketStatus = typeof TICKET_STATUSES[number];
export type TicketPriority = typeof TICKET_PRIORITIES[number];
export type MessageVisibility = typeof MESSAGE_VISIBILITIES[number];
export type AuthorRole = typeof AUTHOR_ROLES[number];

/** Canonical "open work" definition used by every dashboard metric. */
export const OPEN_STATUSES: readonly TicketStatus[] = ['OPEN', 'IN_PROGRESS'];

/** Display name Business users see for any platform staff member (staff identities are not disclosed to tenants). */
export const PLATFORM_SUPPORT_LABEL = 'BranchSuite Support';

/** Audit module for events that must never reach Business readers (internal notes). */
export const INTERNAL_AUDIT_MODULE = 'PLATFORM_INTERNAL';
export const PUBLIC_AUDIT_MODULES = ['SUPPORT', 'PLATFORM_SUPPORT'] as const;
export const PUBLIC_AUDIT_ACTIONS = ['TICKET_CREATED', 'TICKET_REPLIED', 'TICKET_STATUS_CHANGED', 'TICKET_PRIORITY_CHANGED'] as const;

// Lifecycle: RESOLVED can be reopened or closed; CLOSED can only be reopened (to OPEN).
const TRANSITIONS: Record<TicketStatus, readonly TicketStatus[]> = {
  OPEN: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  IN_PROGRESS: ['OPEN', 'RESOLVED', 'CLOSED'],
  RESOLVED: ['OPEN', 'IN_PROGRESS', 'CLOSED'],
  CLOSED: ['OPEN'],
};

export function canTransition(from: string, to: string): boolean {
  return (TRANSITIONS as Record<string, readonly string[]>)[from]?.includes(to) ?? false;
}

export function assertTransition(from: string, to: string): void {
  if (!canTransition(from, to)) throw new BadRequestException(`A ${from} ticket cannot move to ${to}`);
}

/** A new public reply on a RESOLVED ticket reopens it; CLOSED tickets accept no public replies. */
export function replyOutcome(status: string): { allowed: boolean; reopens: boolean } {
  return { allowed: status !== 'CLOSED', reopens: status === 'RESOLVED' };
}

export function isPlatformRole(role: string): role is 'PLATFORM_SUPPORT' | 'PLATFORM_ADMIN' {
  return role === 'PLATFORM_SUPPORT' || role === 'PLATFORM_ADMIN';
}
