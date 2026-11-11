import {
  BadGatewayException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';

export const RAZORPAY_PROVIDER = Symbol('RAZORPAY_PROVIDER');

/** Razorpay Orders API entity (https://razorpay.com/docs/api/orders/). */
export interface RazorpayOrder {
  id: string;
  amount: number;
  amount_paid?: number;
  amount_due?: number;
  currency: string;
  receipt?: string | null;
  // created -> attempted -> paid. No further payments once paid.
  status: 'created' | 'attempted' | 'paid' | string;
  attempts?: number;
  notes?: Record<string, unknown> | unknown[] | null;
}

export interface RazorpayPayment {
  id: string;
  order_id?: string | null;
  // Legacy-only; Razorpay payment entities do not carry it.
  invoice_id?: string | null;
  amount: number;
  currency: string;
  // created | authorized | captured | refunded | failed
  status: string;
  method?: string | null;
  captured?: boolean;
  error_code?: string | null;
  error_description?: string | null;
  error_source?: string | null;
  error_step?: string | null;
  error_reason?: string | null;
  created_at?: number;
}

export interface RazorpayProvider {
  createOrder(input: {
    amountPaise: number;
    currency: 'INR';
    receipt: string;
    notes: Record<string, string>;
  }): Promise<RazorpayOrder>;
  getOrder(id: string): Promise<RazorpayOrder>;
  listOrderPayments(orderId: string): Promise<RazorpayPayment[]>;
  getPayment(id: string): Promise<RazorpayPayment>;
  /** authorized -> captured. Razorpay rejects it for any other state. */
  capturePayment(
    id: string,
    amountPaise: number,
    currency: 'INR',
  ): Promise<RazorpayPayment>;
  publicKeyId(): string;
}

/**
 * Live keys are refused outside production, or anywhere that sets
 * RAZORPAY_ENFORCE_TEST_MODE=true (use this on the Render *testing* service,
 * whose NODE_ENV is "production" but which must only ever use Test Mode).
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
    return this.credentials().keyId;
  }

  async createOrder(input: {
    amountPaise: number;
    currency: 'INR';
    receipt: string;
    notes: Record<string, string>;
  }): Promise<RazorpayOrder> {
    if (!Number.isSafeInteger(input.amountPaise) || input.amountPaise < 100) {
      throw new ServiceUnavailableException('Invalid order amount.');
    }
    const order = await this.request<RazorpayOrder>('/v1/orders', {
      method: 'POST',
      body: JSON.stringify({
        amount: input.amountPaise,
        currency: input.currency,
        receipt: input.receipt.slice(0, 40),
        notes: input.notes,
      }),
    });
    if (
      !order.id?.startsWith('order_') ||
      order.amount !== input.amountPaise ||
      order.currency !== input.currency
    ) {
      throw new ServiceUnavailableException(
        'Razorpay returned an invalid order response.',
      );
    }
    return order;
  }

  getOrder(id: string): Promise<RazorpayOrder> {
    return this.request<RazorpayOrder>(`/v1/orders/${encodeURIComponent(id)}`, {
      method: 'GET',
    });
  }

  async listOrderPayments(orderId: string): Promise<RazorpayPayment[]> {
    const result = await this.request<{ items?: RazorpayPayment[] }>(
      `/v1/orders/${encodeURIComponent(orderId)}/payments`,
      { method: 'GET' },
    );
    return Array.isArray(result.items) ? result.items : [];
  }

  getPayment(id: string): Promise<RazorpayPayment> {
    return this.request<RazorpayPayment>(
      `/v1/payments/${encodeURIComponent(id)}`,
      { method: 'GET' },
    );
  }

  capturePayment(
    id: string,
    amountPaise: number,
    currency: 'INR',
  ): Promise<RazorpayPayment> {
    return this.request<RazorpayPayment>(
      `/v1/payments/${encodeURIComponent(id)}/capture`,
      { method: 'POST', body: JSON.stringify({ amount: amountPaise, currency }) },
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
        `Razorpay ${init.method} ${path.split('?')[0].replace(/\/(order|pay|plan)_[A-Za-z0-9]+/g, '/$1_***')} -> ${response.status} code=${detail.code ?? 'n/a'} reason=${detail.reason ?? 'n/a'}`,
      );
      // Razorpay answers a lookup of an id that does not exist with HTTP 400
      // ("The id provided does not exist"), not 404. Treat that as "gone" so a
      // stale order can be replaced, but only for reads.
      const missing =
        init.method === 'GET' &&
        response.status === 400 &&
        /does not exist|not a valid id|not found/i.test(detail.description ?? '');
      if (response.status === 404 || missing) {
        throw new NotFoundException('Razorpay resource was not found.');
      }
      if (
        response.status >= 400 &&
        response.status < 500 &&
        response.status !== 429
      ) {
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
