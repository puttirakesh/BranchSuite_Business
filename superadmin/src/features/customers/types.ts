import type { BillingCycle, SubscriptionState, Usage } from '../../core/domain/subscription';

export interface CustomerSubscription {
  planId: string;
  cycle: BillingCycle | null;
  /** 'Pending activation' exists only in the backend enum (PENDING_ACTIVATION). */
  status: SubscriptionState | 'Pending activation';
  /** Empty string when the backend has not provided the date. */
  renewOn: string;
  trialEndsOn: string;
  graceEndsOn: string;
  cancelAtRenewal: boolean;
  autoRenew: boolean;
}

export interface CustomerCompany {
  name: string;
  /** Branch names when known; the backend currently returns only a count. */
  branches: string[] | null;
  branchCount?: number;
}

/** A customer business (tenant). Fields the backend does not provide yet are null. */
export interface Customer {
  id: string;
  name: string;
  industry: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  createdOn: string | null;
  source: string | null;
  subscription: CustomerSubscription | null;
  usage: Usage | null;
  companies: CustomerCompany[];
  /** Backend tenant record status (ACTIVE / INACTIVE). Null in preview data. */
  accountStatus: 'Active' | 'Inactive' | null;
}

export interface SubscriptionInput {
  planId: string;
  cycle: BillingCycle;
  status: SubscriptionState;
  renewOn: string;
  trialEndsOn: string;
}
