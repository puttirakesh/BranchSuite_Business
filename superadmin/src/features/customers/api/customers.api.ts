import { endpoints, pendingEndpoints } from '../../../core/api/endpoints';
import { http } from '../../../core/api/client';
import { AppError } from '../../../core/api/api-error';
import { dateOnly, titleCase } from '../../../core/api/mappers';
import { matches, pageOf, type ListQuery, type Page } from '../../../core/api/types';
import { run } from '../../../core/data/source';
import { previewAudit, previewDb } from '../../../core/data/previewStore';
import { addDays } from '../../../core/domain/dates';
import { limitViolations, type BillingCycle } from '../../../core/domain/subscription';
import type { Customer, CustomerSubscription, SubscriptionInput } from '../types';

/** Shape of backend/src/modules/platform/customers/platform-customers.service.ts */
interface BackendCustomer {
  id: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  subscription: { status: string; planId: string | null; billingCycle: string | null } | null;
  companies?: { id: string; name: string; status: string; branchCount: number }[];
}

function mapCustomer(raw: BackendCustomer): Customer {
  const s = raw.subscription;
  const cycle = titleCase(s?.billingCycle);
  return {
    id: raw.id,
    name: raw.name,
    industry: null,
    ownerName: null,
    ownerEmail: null,
    createdOn: dateOnly(raw.createdAt),
    source: null,
    accountStatus: raw.status === 'ACTIVE' ? 'Active' : 'Inactive',
    subscription: s
      ? {
          planId: s.planId ?? '',
          cycle: cycle === 'Monthly' || cycle === 'Annual' ? (cycle as BillingCycle) : null,
          status: s.status === 'PENDING_ACTIVATION' ? 'Pending activation' : (titleCase(s.status) as CustomerSubscription['status']),
          renewOn: '',
          trialEndsOn: '',
          graceEndsOn: '',
          cancelAtRenewal: false,
          autoRenew: false,
        }
      : null,
    usage: null,
    companies: (raw.companies ?? []).map((c) => ({ name: c.name, branches: null, branchCount: c.branchCount })),
  };
}

const notFound = () => new AppError('not_found', 'This customer no longer exists.');

export const customersApi = {
  list: (query: ListQuery) =>
    run<Page<Customer>>({
      preview: () =>
        pageOf(previewDb().customers.filter((c) => matches(query.search, c.name, c.industry, c.ownerName, c.ownerEmail)), query),
      api: async () => {
        const res = await http.get<Page<BackendCustomer>>(endpoints.customers.list, {
          search: query.search || undefined,
          page: query.page ?? 1,
          limit: query.limit ?? 50,
        });
        return { ...res, items: res.items.map(mapCustomer) };
      },
    }),

  get: (id: string) =>
    run<Customer>({
      preview: () => {
        const found = previewDb().customers.find((c) => c.id === id);
        if (!found) throw notFound();
        return structuredClone(found);
      },
      api: async () => mapCustomer(await http.get<BackendCustomer>(endpoints.customers.detail(id))),
    }),

  /** APK "Manage licence". No backend endpoint exists yet. */
  updateSubscription: (id: string, input: SubscriptionInput) =>
    run<Customer>({
      requiredEndpoint: pendingEndpoints.updateSubscription,
      preview: () => {
        const db = previewDb();
        const customer = db.customers.find((c) => c.id === id);
        const plan = db.plans.find((p) => p.id === input.planId);
        if (!customer || !plan) throw new AppError('validation', 'Choose an available customer and plan.');
        if (customer.usage) {
          const over = limitViolations(customer.usage, plan.limits);
          if (over.length) throw new AppError('validation', 'This plan is below current usage: ' + over.join(', '));
        }
        customer.subscription = {
          cancelAtRenewal: customer.subscription?.cancelAtRenewal ?? false,
          autoRenew: customer.subscription?.autoRenew ?? false,
          planId: plan.id,
          cycle: input.cycle,
          status: input.status,
          renewOn: input.renewOn,
          trialEndsOn: input.trialEndsOn,
          graceEndsOn: addDays(input.renewOn, 7),
        };
        previewAudit('Subscription updated', customer.name + ' · ' + input.status);
        return structuredClone(customer);
      },
    }),

  /** Backend-only action (not in the APK): activate or deactivate the business account. */
  setAccountStatus: (id: string, status: 'ACTIVE' | 'INACTIVE') =>
    run<void>({
      requiredEndpoint: 'PATCH /platform/customers/:id/status',
      preview: () => {
        throw new AppError('pending_integration', 'Account status is managed by the backend only.');
      },
      api: async () => {
        await http.patch(endpoints.customers.status(id), { status });
      },
    }),
};
