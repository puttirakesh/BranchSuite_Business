/**
 * TanStack Query hooks for every feature. Keys are centralised so a mutation can
 * invalidate exactly what it changed.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { env } from '../../core/config/env';
import type { ListQuery } from '../../core/api/types';
import { useAuth } from '../../core/auth/AuthContext';
import { customersApi } from '../../features/customers/api/customers.api';
import type { SubscriptionInput } from '../../features/customers/types';
import { plansApi } from '../../features/plans/api/plans.api';
import type { PlanValues } from '../../features/plans/schemas/plan.schema';
import { billingApi, type InvoiceQuery } from '../../features/billing/api/billing.api';
import { supportApi, type TicketQuery } from '../../features/support/api/support.api';
import type { TicketPriority, TicketStatus } from '../../features/support/types';
import { marketingApi } from '../../features/marketing/api/marketing.api';
import type { FollowUpForm } from '../../features/marketing/schemas/follow-up.schema';
import { offersApi } from '../../features/offers/api/offers.api';
import type { CampaignForm, OfferValues } from '../../features/offers/schemas/offer.schema';
import { settingsApi } from '../../features/settings/api/settings.api';
import type { SettingsForm } from '../../features/settings/schemas/settings.schema';
import { auditApi, type AuditQuery } from '../../features/audit/api/audit.api';
import { dashboardApi } from '../../features/dashboard/api/dashboard.api';
import { useSupportFocus } from './support-queries';
import { canRunQuery } from '../../core/permissions/queryAccess';

export const keys = {
  metrics: ['metrics'] as const,
  customers: (q?: ListQuery) => ['customers', q ?? {}] as const,
  customer: (id: string) => ['customer', id] as const,
  plans: ['plans'] as const,
  invoices: (q?: InvoiceQuery) => ['invoices', q ?? {}] as const,
  invoice: (id: string) => ['invoice', id] as const,
  billingSummary: ['billing-summary'] as const,
  tickets: (q?: TicketQuery) => ['tickets', q ?? {}] as const,
  ticket: (id: string) => ['ticket', id] as const,
  prospects: (q?: ListQuery) => ['prospects', q ?? {}] as const,
  prospect: (id: string) => ['prospect', id] as const,
  offers: ['offers'] as const,
  campaigns: ['campaigns'] as const,
  settings: ['settings'] as const,
  audit: (q?: AuditQuery) => ['audit', q ?? {}] as const,
};

function useInvalidate() {
  const client = useQueryClient();
  return (...roots: string[]) =>
    Promise.all([...roots, 'metrics', 'audit', 'support-summary', 'support-businesses'].map((root) => client.invalidateQueries({ queryKey: [root] })));
}

export const useMetrics = () => {
  const { user } = useAuth(); const focused = useSupportFocus();
  return useQuery({ refetchInterval: focused ? 30000 : false, refetchIntervalInBackground: false, queryKey: [...keys.metrics, user?.role], queryFn: () => dashboardApi.metrics(user!.role), enabled: !!user });
};

export const useCustomers = (q: ListQuery = {}) => { const { user } = useAuth(); return useQuery({ queryKey: keys.customers(q), queryFn: () => customersApi.list(q), enabled: canRunQuery(env.dataMode, user?.role, 'customers.view') }); };
export const useCustomer = (id: string) => { const { user } = useAuth(); return useQuery({ queryKey: keys.customer(id), queryFn: () => customersApi.get(id), enabled: canRunQuery(env.dataMode, user?.role, 'customers.view') }); };
export function useUpdateSubscription(id: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: SubscriptionInput) => customersApi.updateSubscription(id, input),
    onSuccess: () => invalidate('customers', 'customer'),
  });
}
export function useSetAccountStatus(id: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (status: 'ACTIVE' | 'INACTIVE') => customersApi.setAccountStatus(id, status),
    onSuccess: () => invalidate('customers', 'customer'),
  });
}

export const usePlans = () => { const { user } = useAuth(); return useQuery({ queryKey: keys.plans, queryFn: plansApi.list, enabled: canRunQuery(env.dataMode, user?.role, 'plans.manage') }); };
export function useSavePlan() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, values }: { id: string | null; values: PlanValues }) => (id ? plansApi.update(id, values) : plansApi.create(values)),
    onSuccess: () => invalidate('plans', 'customers', 'customer'),
  });
}

export const useInvoices = (q: InvoiceQuery = {}) => { const { user } = useAuth(); return useQuery({ queryKey: keys.invoices(q), queryFn: () => billingApi.list(q), enabled: canRunQuery(env.dataMode, user?.role, 'billing.view') }); };
export const useInvoice = (id: string) => { const { user } = useAuth(); return useQuery({ queryKey: keys.invoice(id), queryFn: () => billingApi.get(id), enabled: canRunQuery(env.dataMode, user?.role, 'billing.view') }); };
export const useBillingSummary = () => { const { user } = useAuth(); return useQuery({ queryKey: keys.billingSummary, queryFn: billingApi.summary, enabled: canRunQuery(env.dataMode, user?.role, 'billing.view') }); };

export const useTickets = (q: TicketQuery = {}) => { const focused = useSupportFocus(); const { user } = useAuth(); return useQuery({ queryKey: ['tickets', user?.id, q], queryFn: () => supportApi.list(q), enabled: focused, refetchInterval: focused ? 30000 : false, refetchIntervalInBackground: false }); };
export const useTicket = (id: string) => { const focused = useSupportFocus(); const { user } = useAuth(); return useQuery({ queryKey: ['ticket', user?.id, id], queryFn: () => supportApi.get(id), enabled: focused, refetchInterval: focused ? 30000 : false, refetchIntervalInBackground: false }); };
export function useReplyTicket(id: string) {
  const invalidate = useInvalidate();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { message: string; internal: boolean; status?: TicketStatus; priority?: TicketPriority }) => {
      await supportApi.reply(id, input.message, input.internal, user?.name ?? 'Platform team');

    },
    onSettled: () => invalidate('tickets', 'ticket'),
  });
}

export const useProspects = (q: ListQuery = {}) => { const { user } = useAuth(); return useQuery({ queryKey: keys.prospects(q), queryFn: () => marketingApi.list(q), enabled: canRunQuery(env.dataMode, user?.role, 'marketing.manage') }); };
export const useProspect = (id: string) => { const { user } = useAuth(); return useQuery({ queryKey: keys.prospect(id), queryFn: () => marketingApi.get(id), enabled: canRunQuery(env.dataMode, user?.role, 'marketing.manage') }); };
export function useUpdateFollowUp(id: string) {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (input: FollowUpForm) => marketingApi.updateFollowUp(id, input), onSuccess: () => invalidate('prospects', 'prospect') });
}

export const useOffers = (visible = true) => { const { user } = useAuth(); return useQuery({ queryKey: keys.offers, queryFn: offersApi.list, enabled: canRunQuery(env.dataMode, user?.role, 'offers.manage', visible) }); };
export const useCampaigns = () => { const { user } = useAuth(); return useQuery({ queryKey: keys.campaigns, queryFn: offersApi.campaigns, enabled: canRunQuery(env.dataMode, user?.role, 'offers.manage') }); };
export function useSaveOffer() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: ({ id, values }: { id: string | null; values: OfferValues }) => offersApi.save(id, values), onSuccess: () => invalidate('offers', 'campaigns') });
}
export function useSaveCampaign() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: ({ id, values }: { id: string | null; values: CampaignForm }) => offersApi.saveCampaign(id, values), onSuccess: () => invalidate('campaigns') });
}

export const useSettings = () => { const { user } = useAuth(); return useQuery({ queryKey: keys.settings, queryFn: settingsApi.get, enabled: canRunQuery(env.dataMode, user?.role, 'settings.manage') }); };
export function useSaveSettings() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (input: SettingsForm) => settingsApi.save(input), onSuccess: () => invalidate('settings') });
}

export const useAudit = (q: AuditQuery = {}) => { const { user } = useAuth(); return useQuery({ queryKey: keys.audit(q), queryFn: () => auditApi.list(q), enabled: canRunQuery(env.dataMode, user?.role, 'audit.view') }); };

export function useUpdateTicketControls(id: string) {
  const invalidate = useInvalidate();
  return useMutation({
    // Status and priority use separate atomic endpoints; callers save them independently so one failure never half-applies a combined save.
    // `expected*` is the value the user was looking at: a concurrent change yields a 409 instead of a silent overwrite.
    mutationFn: async (input: { status?: TicketStatus; expectedStatus?: TicketStatus; priority?: TicketPriority; expectedPriority?: TicketPriority }) => {
      if (input.status) await supportApi.setStatus(id, input.status, input.expectedStatus);
      if (input.priority) await supportApi.setPriority(id, input.priority, input.expectedPriority);
    },
    onSettled: () => invalidate('tickets', 'ticket'),
  });
}
