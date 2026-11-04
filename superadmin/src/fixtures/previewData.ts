/**
 * NON-PRODUCTION PREVIEW FIXTURES.
 *
 * These records reproduce the sample workspace shipped inside the reference APK
 * (assets/saas-model.js) so the UI can be reviewed without a backend. They are not
 * business data, are disabled by default and are only loaded when
 * EXPO_PUBLIC_PREVIEW_DATA=true. Usage numbers are the values the APK derived from its
 * own sample employees. Delete this folder once the backend is connected.
 */
import type { Customer } from '../features/customers/types';
import type { Plan } from '../features/plans/types';
import type { Invoice } from '../features/billing/types';
import type { Ticket } from '../features/support/types';
import type { Prospect } from '../features/marketing/types';
import type { Offer, Campaign } from '../features/offers/types';
import type { PlatformSettings } from '../features/settings/types';
import type { AuditEvent } from '../features/audit/types';
import type { Role } from '../core/permissions/roles';

export interface PreviewAccount {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface PreviewData {
  accounts: PreviewAccount[];
  plans: Plan[];
  customers: Customer[];
  invoices: Invoice[];
  tickets: Ticket[];
  prospects: Prospect[];
  offers: Offer[];
  campaigns: Campaign[];
  settings: PlatformSettings;
  audit: AuditEvent[];
}

/** Password accepted for preview accounts only. Has no meaning against a real backend. */
export const PREVIEW_PASSWORD = 'Demo123';

const features = { crm: true, people: true, payroll: true, reports: true };

export function createPreviewData(): PreviewData {
  const plans: Plan[] = [
    { id: 'starter', name: 'Starter', monthly: 999, annual: 9990, limits: { employees: 75, branches: 2, companies: 1, users: 5 }, trialDays: 14, enabled: true, description: 'For small teams beginning to organise work.', features: { ...features } },
    { id: 'growth', name: 'Growth', monthly: 2499, annual: 24990, limits: { employees: 250, branches: 10, companies: 3, users: 15 }, trialDays: 14, enabled: true, description: 'For growing teams across branches.', features: { ...features } },
    { id: 'scale', name: 'Scale', monthly: 5999, annual: 59990, limits: { employees: 1000, branches: 50, companies: 10, users: 100 }, trialDays: 14, enabled: true, description: 'For larger businesses with more locations.', features: { ...features } },
  ];
  const customers: Customer[] = [
    { id: 't1', name: '5 Gen Educon', industry: 'Education', ownerName: 'Neha Iyer', ownerEmail: 'admin@demo.example', createdOn: '2026-09-15', source: 'Website',
      subscription: { planId: 'growth', cycle: 'Monthly', status: 'Active', renewOn: '2026-10-15', trialEndsOn: '2026-09-29', graceEndsOn: '2026-10-22', cancelAtRenewal: false, autoRenew: true },
      usage: { employees: 128, branches: 3, companies: 1, users: 6 }, companies: [{ name: '5 Gen Educon', branches: ['Vijayawada', 'Guntur', 'Hyderabad'] }], accountStatus: null },
    { id: 't2', name: 'Northstar Services', industry: 'Professional services', ownerName: 'Priya Mehta', ownerEmail: 'northstar@demo.example', createdOn: '2026-09-24', source: 'Referral',
      subscription: { planId: 'growth', cycle: 'Annual', status: 'Trial', renewOn: '2026-10-08', trialEndsOn: '2026-10-08', graceEndsOn: '2026-10-15', cancelAtRenewal: false, autoRenew: false },
      usage: { employees: 74, branches: 2, companies: 1, users: 1 }, companies: [{ name: 'Northstar Services', branches: ['Bengaluru', 'Chennai'] }], accountStatus: null },
    { id: 't3', name: 'BrightPath Labs', industry: 'Technology', ownerName: 'Dev Menon', ownerEmail: 'brightpath@demo.example', createdOn: '2026-08-01', source: 'Partner',
      subscription: { planId: 'starter', cycle: 'Monthly', status: 'Past due', renewOn: '2026-10-01', trialEndsOn: '2026-08-15', graceEndsOn: '2026-10-08', cancelAtRenewal: false, autoRenew: true },
      usage: { employees: 58, branches: 2, companies: 1, users: 1 }, companies: [{ name: 'BrightPath Labs', branches: ['Pune', 'Mumbai'] }], accountStatus: null },
  ];
  return {
    accounts: [
      { id: 'platform-admin', name: 'Platform Owner', email: 'platform@demo.example', role: 'PLATFORM_ADMIN' },
      { id: 'platform-support', name: 'Customer Success', email: 'support@demo.example', role: 'PLATFORM_SUPPORT' },
    ],
    plans,
    customers,
    invoices: [
      { id: 'BS-DEMO-1001', number: 'BS-DEMO-1001', customerId: 't1', customerName: '5 Gen Educon', customerEmail: 'admin@demo.example', planName: 'Growth', cycle: 'Monthly', subtotal: 2499, discount: 0, amount: 2499, currency: 'INR', status: 'Paid', issuedOn: '2026-09-15', dueOn: '2026-09-15', paidOn: '2026-09-15', reference: 'DEMO-PAY-1001', description: 'Subscription' },
      { id: 'BS-DEMO-1002', number: 'BS-DEMO-1002', customerId: 't3', customerName: 'BrightPath Labs', customerEmail: 'brightpath@demo.example', planName: 'Starter', cycle: 'Monthly', subtotal: 999, discount: 0, amount: 999, currency: 'INR', status: 'Unpaid', issuedOn: '2026-10-01', dueOn: '2026-10-01', paidOn: null, reference: null, description: 'Subscription' },
    ],
    tickets: [
      { id: 'BS-TK-101', customerId: 't1', customerName: '5 Gen Educon', subject: 'Help with annual subscription', category: 'Billing', status: 'Open', priority: 'Normal', createdOn: '2026-10-02',
        messages: [{ id: 'm1', by: 'Neha Iyer', text: 'Can our business switch to annual billing?', internal: false, time: '2026-10-02' }] },
      { id: 'BS-TK-102', customerId: 't3', customerName: 'BrightPath Labs', subject: 'Subscription payment retry', category: 'Subscription', status: 'In progress', priority: 'High', createdOn: '2026-10-02',
        messages: [
          { id: 'm2', by: 'Dev Menon', text: 'Our demo payment failed. Please guide us.', internal: false, time: '2026-10-02' },
          { id: 'm3', by: 'Customer Success', text: 'Track the retry request; no real gateway is connected.', internal: true, time: '2026-10-02' },
        ] },
    ],
    prospects: [
      { id: 'BS-LD-101', business: 'Coastal Traders', contact: 'Sana Ali', email: 'sana@coastal.example', phone: '9000011111', industry: 'Retail', employees: 90, source: 'Website', status: 'Contacted', followup: '2026-10-05', notes: 'Interested in CRM, payroll and three branches.', convertedCustomerName: null },
      { id: 'BS-LD-102', business: 'Lotus Healthcare', contact: 'Arjun Rao', email: 'arjun@lotus.example', phone: '9000012222', industry: 'Healthcare', employees: 40, source: 'Partner', status: 'New', followup: '2026-10-04', notes: 'Request a product demo.', convertedCustomerName: null },
    ],
    offers: [{ id: 'COUPON-1', code: 'SAVE10', discountType: 'PERCENT', discount: 10, maxUses: 100, used: 0, enabled: true, expiresOn: '2026-12-31' }],
    campaigns: [{ id: 'CAM-1', name: 'Founding businesses', channel: 'Website', offerCode: 'SAVE10', status: 'Active', notes: 'Demo offer on the first subscription invoice.' }],
    settings: { brand: 'BranchSuite', supportEmail: 'help@branchsuite.demo', trialEnabled: true },
    audit: [],
  };
}
