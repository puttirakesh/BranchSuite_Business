import {
  BadGatewayException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
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
  paid_count?: number | null;
  total_count?: number | null;
  notes?: Record<string, unknown> | unknown[] | null;
}

export interface RazorpayPayment {
  id: string;
  // NOTE: Razorpay payment entities do NOT carry subscription_id. A payment is
  // tied to a subscription through its invoice (invoice_id) or, at checkout
  // time, through the signed razorpay_subscription_id. Kept optional only so
  // that synthetic/legacy payloads remain parseable.
  subscription_id?: string | null;
  invoice_id?: string | null;
  order_id?: string | null;
  amount: number;
  currency: string;
  status: string;
  error_code?: string | null;
  error_description?: string | null;
  error_source?: string | null;
  error_step?: string | null;
  error_reason?: string | null;
  created_at?: number;
  captured_at?: number | null;
  captured?: boolean;
}

export interface RazorpayInvoice {
  id: string;
  subscription_id?: string | null;
  payment_id?: string | null;
  status: string;
  amount: number;
  currency: string;
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
    /** Distinguishes a replacement subscription from the one it replaces. */
    attempt?: number;
  }): Promise<RazorpaySubscription>;
  getPlan(id: string): Promise<RazorpayPlan>;
  getSubscription(id: string): Promise<RazorpaySubscription>;
  cancelSubscription(id: string): Promise<void>;
  getPayment(id: string): Promise<RazorpayPayment>;
  getInvoice(id: string): Promise<RazorpayInvoice>;
  listSubscriptionInvoices(subscriptionId: string): Promise<RazorpayInvoice[]>;
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

/**
 * Live keys are refused outside production, or anywhere that sets
 * RAZORPAY_ENFORCE_TEST_MODE=true (use this on the Render *testing* service,
 * whose NODE_ENV may be "production"). Prevents real charges from a
 * development or testing deployment that was handed a live key by mistake.
 */
export function assertRazorpayKeyModeAllowed(keyId: string): void {
  const live = keyId.startsWith('rzp_live_');
  const testOnly =
    process.env.NODE_ENV !== 'production' ||
    process.env.RAZORPAY_ENFORCE_TEST_MODE === 'true';
  if (live && testOnly) {
    throw new ServiceUnavailableException(
      'Razorpay live keys are not permitted in this environment. Use Test Mode keys.',
    );
  }
  if (!live && !keyId.startsWith('rzp_test_')) {
    throw new ServiceUnavailableException(
      'RAZORPAY_KEY_ID is not a valid Razorpay key.',
    );
  }
}

@Injectable()
export class RazorpayHttpProvider implements RazorpayProvider {
  private readonly logger = new Logger(RazorpayHttpProvider.name);

  private credentials(): { keyId: string; keySecret: string } {
    const keyId = process.env.RAZORPAY_KEY_ID?.trim();
    const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
    if (!keyId || !keySecret) {
      throw new ServiceUnavailableException(
        'Razorpay API credentials are not configured.',
      );
    }
    assertRazorpayKeyModeAllowed(keyId);
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
    attempt?: number;
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

    // Razorpay allows at most 10 years of billing cycles per subscription.
    // 120 monthly / 10 annual cycles is exactly that documented ceiling; the
    // value is unchanged from the original integration (see the report's
    // card-mandate section for why it is flagged, not altered).
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
              .update(
                `${input.tenantId}:${input.planId}:${input.billingCycle}:${input.attempt ?? 0}`,
              )
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
    return this.request<RazorpayPlan>(`/v1/plans/${encodeURIComponent(id)}`, {
      method: 'GET',
    });
  }

  getSubscription(id: string): Promise<RazorpaySubscription> {
    return this.request<RazorpaySubscription>(
      `/v1/subscriptions/${encodeURIComponent(id)}`,
      { method: 'GET' },
    );
  }

  async cancelSubscription(id: string): Promise<void> {
    await this.request<unknown>(
      `/v1/subscriptions/${encodeURIComponent(id)}/cancel`,
      { method: 'POST', body: JSON.stringify({ cancel_at_cycle_end: false }) },
    );
  }

  getPayment(id: string): Promise<RazorpayPayment> {
    return this.request<RazorpayPayment>(
      `/v1/payments/${encodeURIComponent(id)}`,
      { method: 'GET' },
    );
  }

  getInvoice(id: string): Promise<RazorpayInvoice> {
    return this.request<RazorpayInvoice>(
      `/v1/invoices/${encodeURIComponent(id)}`,
      { method: 'GET' },
    );
  }

  async listSubscriptionInvoices(
    subscriptionId: string,
  ): Promise<RazorpayInvoice[]> {
    const result = await this.request<{ items?: RazorpayInvoice[] }>(
      `/v1/invoices?subscription_id=${encodeURIComponent(subscriptionId)}&count=100`,
      { method: 'GET' },
    );
    return Array.isArray(result.items) ? result.items : [];
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
      // Razorpay error bodies are {error:{code,description,source,step,reason}}.
      // Log only those safe diagnostic fields; never the request or credentials.
      let detail: { code?: string; description?: string; reason?: string } = {};
      try {
        const body = (await response.json()) as { error?: typeof detail };
        detail = body.error ?? {};
      } catch {
        // Non-JSON error body.
      }
      this.logger.warn(
        `Razorpay ${init.method} ${path.split('?')[0].replace(/\/(sub|pay|inv|plan)_[A-Za-z0-9]+/g, '/$1_***')} -> ${response.status} code=${detail.code ?? 'n/a'} reason=${detail.reason ?? 'n/a'}`,
      );
      if (response.status === 404) {
        throw new NotFoundException('Razorpay resource was not found.');
      }
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        throw new BadGatewayException(
          `Razorpay rejected the request (${response.status}${detail.code ? ` ${detail.code}` : ''}).`,
        );
      }
      throw new ServiceUnavailableException(
        `Razorpay request failed with status ${response.status}.`,
      );
    }

    return (await response.json()) as T;
  }
}
