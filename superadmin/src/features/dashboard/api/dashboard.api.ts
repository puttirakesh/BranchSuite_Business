import { endpoints } from '../../../core/api/endpoints';
import { http } from '../../../core/api/client';
import { dateOnly, shortId, toNumber } from '../../../core/api/mappers';
import { run } from '../../../core/data/source';
import { previewDb } from '../../../core/data/previewStore';
import { businessDate } from '../../../core/domain/clock';
import { monthlyValue, needsAttention, type SubscriptionState } from '../../../core/domain/subscription';
import type { Role } from '../../../core/permissions/roles';
import { customerStatus } from '../../customers/utils/customer-status';
import type { AuditEvent } from '../../audit/types';

/** null means the current backend does not provide this figure; the UI shows a dash. */
export interface PlatformMetrics {
  customers: number | null;
  active: number | null;
  trials: number | null;
  attention: number | null;
  monthlyRecurring: number | null;
  totalPaid: number | null;
  unpaid: number | null;
  openSupport: number | null;
  openProspects: number | null;
  plans: number | null;
  recentActivity: AuditEvent[];
}

const empty: PlatformMetrics = {
  customers: null, active: null, trials: null, attention: null, monthlyRecurring: null, totalPaid: null,
  unpaid: null, openSupport: null, openProspects: null, plans: null, recentActivity: [],
};

/** Port of saas-model.js `platformMetrics` for preview data. */
function previewMetrics(): PlatformMetrics {
  const db = previewDb();
  const states = db.customers.map((c) => customerStatus(c, businessDate()));
  const mrr = db.customers.reduce((sum, c) => {
    const s = c.subscription;
    const plan = db.plans.find((p) => p.id === s?.planId);
    const state = customerStatus(c);
    if (!s || !plan || !s.cycle || (state !== 'Active' && state !== 'Past due')) return sum;
    return sum + monthlyValue(s.cycle, plan.monthly, plan.annual);
  }, 0);
  return {
    customers: db.customers.length,
    active: states.filter((s) => s === 'Active').length,
    trials: states.filter((s) => s === 'Trial').length,
    attention: states.filter((s) => needsAttention(s as SubscriptionState)).length,
    monthlyRecurring: Math.round(mrr),
    totalPaid: db.invoices.filter((i) => i.status === 'Paid').reduce((n, i) => n + i.amount, 0),
    unpaid: db.invoices.filter((i) => i.status === 'Unpaid').reduce((n, i) => n + i.amount, 0),
    openSupport: db.tickets.filter((t) => t.status !== 'Resolved' && t.status !== 'Closed').length,
    openProspects: db.prospects.filter((p) => p.status !== 'Converted' && p.status !== 'Closed').length,
    plans: db.plans.length,
    recentActivity: db.audit.slice(0, 5),
  };
}

interface BackendSummary {
  businesses: { total: number };
  subscriptions: { total: number; active: number };
  revenue: { totalPaid: string };
  support: { openTickets: number };
  recentActivity: { id: string; actorId: string | null; action: string; module: string; detail: string | null; createdAt: string }[];
}

export const dashboardApi = {
  metrics: (role: Role) =>
    run<PlatformMetrics>({
      preview: previewMetrics,
      api: async () => {
        if (role === 'PLATFORM_SUPPORT') {
          // /platform/dashboard/summary is admin-only; support can read the support summary.
          const s = await http.get<{ byStatus: Record<string, number> }>(endpoints.support.summary);
          return { ...empty, openSupport: (s.byStatus.OPEN ?? 0) + (s.byStatus.IN_PROGRESS ?? 0) };
        }
        const s = await http.get<BackendSummary>(endpoints.dashboard.summary);
        return {
          ...empty,
          customers: s.businesses.total,
          active: s.subscriptions.active,
          totalPaid: toNumber(s.revenue.totalPaid),
          openSupport: s.support.openTickets,
          recentActivity: s.recentActivity.slice(0, 5).map((e) => ({
            id: e.id, action: e.action, detail: e.detail ?? '', actor: 'User ' + shortId(e.actorId), time: dateOnly(e.createdAt) ?? '', module: e.module,
          })),
        };
      },
    }),
};
