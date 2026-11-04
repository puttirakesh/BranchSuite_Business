/**
 * Subscription rules ported from the reference APK (saas-model.js).
 * Pure functions with no React or I/O; covered by tests/domain.test.ts.
 * The backend remains the authority. These rules only drive UI state and hints.
 */
export const SUBSCRIPTION_STATES = ['Active', 'Trial', 'Past due', 'Expired', 'Suspended', 'Cancelled'] as const;
export type SubscriptionState = (typeof SUBSCRIPTION_STATES)[number];
export const BILLING_CYCLES = ['Monthly', 'Annual'] as const;
export type BillingCycle = (typeof BILLING_CYCLES)[number];

export interface SubscriptionTerms {
  status: SubscriptionState;
  renewOn: string;
  trialEndsOn: string;
  graceEndsOn: string;
  cancelAtRenewal: boolean;
}

export interface Usage {
  employees: number;
  branches: number;
  companies: number;
  users: number;
}
export type Limits = Usage;
export const USAGE_KEYS: (keyof Usage)[] = ['employees', 'branches', 'companies', 'users'];

/** Status after applying trial expiry, grace periods and scheduled cancellation. */
export function effectiveStatus(s: SubscriptionTerms, onDate: string): SubscriptionState {
  if (s.status === 'Trial' && s.trialEndsOn < onDate) return 'Expired';
  if ((s.status === 'Active' || s.status === 'Past due') && s.renewOn < onDate) {
    if (s.cancelAtRenewal) return 'Cancelled';
    return s.graceEndsOn >= onDate ? 'Past due' : 'Expired';
  }
  return s.status;
}

export const needsAttention = (status: SubscriptionState) =>
  status === 'Past due' || status === 'Expired' || status === 'Suspended';

/** One message per limit that current usage exceeds. An empty array means the plan fits. */
export function limitViolations(usage: Usage, limits: Limits): string[] {
  return USAGE_KEYS.filter((key) => usage[key] > limits[key]).map(
    (key) => usage[key] + ' ' + key + ' / ' + limits[key] + ' allowed',
  );
}

export function monthlyValue(cycle: BillingCycle, monthly: number, annual: number) {
  return cycle === 'Annual' ? annual / 12 : monthly;
}
