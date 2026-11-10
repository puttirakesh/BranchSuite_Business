export type SubscriptionPlanId = 'starter' | 'growth' | 'scale';
export type SubscriptionBillingCycle = 'monthly' | 'annual';

export interface SubscriptionPlan {
  id: SubscriptionPlanId;
  name: string;
  monthlyAmountPaise: number;
  annualAmountPaise: number;
  limits: {
    companies: number;
    branches: number;
    employees: number;
    users: number;
  };
}

export const SUBSCRIPTION_PLANS: Record<SubscriptionPlanId, SubscriptionPlan> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    monthlyAmountPaise: 99_900,
    annualAmountPaise: 999_000,
    limits: { companies: 1, branches: 2, employees: 75, users: 5 },
  },
  growth: {
    id: 'growth',
    name: 'Growth',
    monthlyAmountPaise: 249_900,
    annualAmountPaise: 2_499_000,
    limits: { companies: 3, branches: 10, employees: 250, users: 15 },
  },
  scale: {
    id: 'scale',
    name: 'Scale',
    monthlyAmountPaise: 599_900,
    annualAmountPaise: 5_999_000,
    limits: { companies: 10, branches: 50, employees: 1_000, users: 100 },
  },
};

export function getSubscriptionPlan(
  planId: string,
  billingCycle: string,
): { plan: SubscriptionPlan; billingCycle: SubscriptionBillingCycle; amountPaise: number } {
  if (!Object.hasOwn(SUBSCRIPTION_PLANS, planId)) {
    throw new Error('Unknown subscription plan');
  }
  if (billingCycle !== 'monthly' && billingCycle !== 'annual') {
    throw new Error('Unknown subscription billing cycle');
  }

  const plan = SUBSCRIPTION_PLANS[planId as SubscriptionPlanId];
  return {
    plan,
    billingCycle,
    amountPaise:
      billingCycle === 'monthly'
        ? plan.monthlyAmountPaise
        : plan.annualAmountPaise,
  };
}
