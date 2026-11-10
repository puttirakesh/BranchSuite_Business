import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { getSubscriptionPlan } from './subscription-catalog';
import type {
  SubscriptionBillingCycle,
  SubscriptionPlanId,
} from './subscription-catalog';

export const RAZORPAY_PROVIDER = Symbol('RAZORPAY_PROVIDER');

export interface RazorpaySubscription {
  id: string;
  plan_id: string;
  status: string;
  short_url?: string | null;
  current_start?: number | null;
  current_end?: number | null;
  ended_at?: number | null;
  cancel_at_cycle_end?: boolean;
}

export interface RazorpayPayment {
  id: string;
  subscription_id?: string | null;
  amount: number;
  currency: string;
  status: string;
  error_code?: string | null;
  error_description?: string | null;
  created_at?: number;
  captured_at?: number | null;
  captured?: boolean;
}

export interface RazorpayPlan {
  id: string;
  period: string;
  interval: number;
  item: { amount: number; currency: string };
}

export interface RazorpayProvider {
  createSubscription(input: {
    planId: SubscriptionPlanId;
    billingCycle: SubscriptionBillingCycle;
    tenantId: string;
  }): Promise<RazorpaySubscription>;
  getPlan(id: string): Promise<RazorpayPlan>;
  getSubscription(id: string): Promise<RazorpaySubscription>;
  getPayment(id: string): Promise<RazorpayPayment>;
  publicKeyId(): string;
}

const PLAN_ENV: Record<
  SubscriptionPlanId,
  Record<SubscriptionBillingCycle, string>
> = {
  starter: {
    monthly: 'RAZORPAY_PLAN_STARTER_MONTHLY',
    annual: 'RAZORPAY_PLAN_STARTER_ANNUAL',
  },
  growth: {
    monthly: 'RAZORPAY_PLAN_GROWTH_MONTHLY',
    annual: 'RAZORPAY_PLAN_GROWTH_ANNUAL',
  },
  scale: {
    monthly: 'RAZORPAY_PLAN_SCALE_MONTHLY',
    annual: 'RAZORPAY_PLAN_SCALE_ANNUAL',
  },
};

export function configuredRazorpayPlanId(
  planId: SubscriptionPlanId,
  billingCycle: SubscriptionBillingCycle,
): string {
  const envName = PLAN_ENV[planId][billingCycle];
  const value = process.env[envName]?.trim();
  if (!value || !/^plan_[A-Za-z0-9]+$/.test(value)) {
    throw new ServiceUnavailableException(
      `Razorpay plan configuration is missing or invalid: ${envName}.`,
    );
  }
  return value;
}

@Injectable()
export class RazorpayHttpProvider implements RazorpayProvider {
  private credentials(): { keyId: string; keySecret: string } {
    const keyId = process.env.RAZORPAY_KEY_ID?.trim();
    const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
    if (!keyId || !keySecret) {
      throw new ServiceUnavailableException(
        'Razorpay API credentials are not configured.',
      );
    }
    return { keyId, keySecret };
  }

  publicKeyId(): string {
    const { keyId } = this.credentials();
    return keyId;
  }

  async createSubscription(input: {
    planId: SubscriptionPlanId;
    billingCycle: SubscriptionBillingCycle;
    tenantId: string;
  }): Promise<RazorpaySubscription> {
    const providerPlanId = configuredRazorpayPlanId(
      input.planId,
      input.billingCycle,
    );
    const remotePlan = await this.getPlan(providerPlanId);
    const expected = getSubscriptionPlan(input.planId, input.billingCycle);
    if (
      remotePlan.id !== providerPlanId ||
      remotePlan.item.amount !== expected.amountPaise ||
      remotePlan.item.currency !== 'INR' ||
      remotePlan.period !==
        (input.billingCycle === 'monthly' ? 'monthly' : 'yearly') ||
      remotePlan.interval !== 1
    ) {
      throw new ServiceUnavailableException(
        'The configured Razorpay plan does not match the selected price and billing cycle.',
      );
    }

    const totalCount = input.billingCycle === 'monthly' ? 120 : 10;
    const subscription = await this.request<RazorpaySubscription>(
      '/v1/subscriptions',
      {
        method: 'POST',
        body: JSON.stringify({
          plan_id: providerPlanId,
          total_count: totalCount,
          quantity: 1,
          customer_notify: true,
          notes: {
            tenant_id: input.tenantId,
            plan_id: input.planId,
            billing_cycle: input.billingCycle,
            request_id: createHash('sha256')
              .update(`${input.tenantId}:${input.planId}:${input.billingCycle}`)
              .digest('hex')
              .slice(0, 32),
          },
        }),
      },
    );

    if (
      !subscription.id?.startsWith('sub_') ||
      subscription.plan_id !== providerPlanId
    ) {
      throw new ServiceUnavailableException(
        'Razorpay returned an invalid subscription response.',
      );
    }
    return subscription;
  }

  getPlan(id: string): Promise<RazorpayPlan> {
    return this.request<RazorpayPlan>(
      `/v1/plans/${encodeURIComponent(id)}`,
      { method: 'GET' },
    );
  }

  getSubscription(id: string): Promise<RazorpaySubscription> {
    return this.request<RazorpaySubscription>(
      `/v1/subscriptions/${encodeURIComponent(id)}`,
      { method: 'GET' },
    );
  }

  getPayment(id: string): Promise<RazorpayPayment> {
    return this.request<RazorpayPayment>(
      `/v1/payments/${encodeURIComponent(id)}`,
      { method: 'GET' },
    );
  }

  private async request<T>(
    path: string,
    init: { method: 'GET' | 'POST'; body?: string },
  ): Promise<T> {
    const { keyId, keySecret } = this.credentials();
    let response: Response;
    try {
      response = await fetch(`https://api.razorpay.com${path}`, {
        method: init.method,
        headers: {
          Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
          Accept: 'application/json',
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(init.body ? { body: init.body } : {}),
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new ServiceUnavailableException(
        'Unable to reach Razorpay. Please retry the payment operation.',
      );
    }

    if (!response.ok) {
      throw new ServiceUnavailableException(
        `Razorpay request failed with status ${response.status}.`,
      );
    }

    return (await response.json()) as T;
  }
}
