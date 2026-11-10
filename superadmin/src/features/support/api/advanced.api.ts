import { http } from '../../../core/api/client';
import { env } from '../../../core/config/env';
import { AppError } from '../../../core/api/api-error';
import type { Page } from '../../../core/api/types';

export type SupportAgent = { id: string; name: string };
export type SupportSummary = {
  total: number; open: number; byStatus: Record<string, number>; assigned: number; unassigned: number;
  overdue: number; escalated: number; unread: number; averageFirstResponseMs: number | null; averageResolutionMs: number | null;
  trend: { day: string; created: number; publicMessages: number }[];
  workload: { id: string; name: string; status: string; assigned: number; open: number }[];
};
export type SupportBusiness = { id: string; tenantId: string; businessName: string; companyName: string; ticketCount: number; openTicketCount: number; latestActivity: string };
export type SupportBusinessDetail = { company: { id: string; name: string; tenant: { id: string; name: string } }; branches: SupportAgent[]; requesters: { name: string }[]; requesterLimit: number };
export type BusinessQuery = { search?: string; page?: number; openOnly?: 'true'; sort?: string };
export type SupportAction = { path: string; method: 'POST' | 'PATCH'; body: Record<string, unknown> };

function realApi() { if (env.dataMode !== 'api') throw new AppError('validation', 'Advanced support requires a connected backend.'); }
export const advancedSupportApi = {
  agents: () => { realApi(); return http.get<SupportAgent[]>('/platform/support/agents'); },
  summary: () => { realApi(); return http.get<SupportSummary>('/platform/support/summary'); },
  businesses: (q: BusinessQuery) => { realApi(); return http.get<Page<SupportBusiness>>('/platform/support/businesses', { ...q, limit: 20 }); },
  business: (id: string) => { realApi(); return http.get<SupportBusinessDetail>('/platform/support/businesses/' + encodeURIComponent(id)); },
  action: ({ path, method, body }: SupportAction) => { realApi(); return method === 'POST' ? http.post('/platform/support/' + path, body) : http.patch('/platform/support/' + path, body); },
};
