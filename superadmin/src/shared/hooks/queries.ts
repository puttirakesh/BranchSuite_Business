/**
 * TanStack Query hooks for every feature. Keys are centralised so a mutation can
 * invalidate exactly what it changed.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
    Promise.all([...roots, 'metrics', 'audit'].map((root) => client.invalidateQueries({ queryKey: [root] })));
}

export const useMetrics = () => {
  const { user } = useAuth();
  return useQuery({ queryKey: [...keys.metrics, user?.role], queryFn: () => dashboardApi.metrics(user!.role), enabled: !!user });
};

export const useCustomers = (q: ListQuery = {}) => useQuery({ queryKey: keys.customers(q), queryFn: () => customersApi.list(q) });
export const useCustomer = (id: string) => useQuery({ queryKey: keys.customer(id), queryFn: () => customersApi.get(id) });
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

export const usePlans = () => useQuery({ queryKey: keys.plans, queryFn: plansApi.list });
export function useSavePlan() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, values }: { id: string | null; values: PlanValues }) => (id ? plansApi.update(id, values) : plansApi.create(values)),
    onSuccess: () => invalidate('plans', 'customers', 'customer'),
  });
}

export const useInvoices = (q: InvoiceQuery = {}) => useQuery({ queryKey: keys.invoices(q), queryFn: () => billingApi.list(q) });
export const useInvoice = (id: string) => useQuery({ queryKey: keys.invoice(id), queryFn: () => billingApi.get(id) });
export const useBillingSummary = () => useQuery({ queryKey: keys.billingSummary, queryFn: billingApi.summary });

export const useTickets = (q: TicketQuery = {}) => useQuery({ queryKey: keys.tickets(q), queryFn: () => supportApi.list(q) });
export const useTicket = (id: string) => useQuery({ queryKey: keys.ticket(id), queryFn: () => supportApi.get(id) });
export function useReplyTicket(id: string) {
  const invalidate = useInvalidate();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { message: string; internal: boolean; status?: TicketStatus; priority?: TicketPriority }) => {
      await supportApi.reply(id, input.message, input.internal, user?.name ?? 'Platform team');
      if (input.status) await supportApi.setStatus(id, input.status);
      if (input.priority) await supportApi.setPriority(id, input.priority);
    },
    onSettled: () => invalidate('tickets', 'ticket'),
  });
}

export const useProspects = (q: ListQuery = {}) => useQuery({ queryKey: keys.prospects(q), queryFn: () => marketingApi.list(q) });
export const useProspect = (id: string) => useQuery({ queryKey: keys.prospect(id), queryFn: () => marketingApi.get(id) });
export function useUpdateFollowUp(id: string) {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (input: FollowUpForm) => marketingApi.updateFollowUp(id, input), onSuccess: () => invalidate('prospects', 'prospect') });
}

export const useOffers = () => useQuery({ queryKey: keys.offers, queryFn: offersApi.list });
export const useCampaigns = () => useQuery({ queryKey: keys.campaigns, queryFn: offersApi.campaigns });
export function useSaveOffer() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: ({ id, values }: { id: string | null; values: OfferValues }) => offersApi.save(id, values), onSuccess: () => invalidate('offers', 'campaigns') });
}
export function useSaveCampaign() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: ({ id, values }: { id: string | null; values: CampaignForm }) => offersApi.saveCampaign(id, values), onSuccess: () => invalidate('campaigns') });
}

export const useSettings = () => useQuery({ queryKey: keys.settings, queryFn: settingsApi.get });
export function useSaveSettings() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (input: SettingsForm) => settingsApi.save(input), onSuccess: () => invalidate('settings') });
}

export const useAudit = (q: AuditQuery = {}) => useQuery({ queryKey: keys.audit(q), queryFn: () => auditApi.list(q) });
