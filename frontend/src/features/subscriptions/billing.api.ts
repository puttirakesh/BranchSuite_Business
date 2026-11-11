import { api } from "../../core/api/client";
import { call } from "../../core/admin/http";

/** Mirrors backend SubscriptionsService (prepaid one-time orders, manual renewal). */
export interface BillingPayment {
  id: string;
  providerPaymentId: string;
  providerOrderId: string | null;
  amountPaise: number;
  currency: string;
  status: string; // CAPTURED | AUTHORIZED | FAILED | REJECTED | REFUNDED
  method: string | null;
  failureCode: string | null;
  failureDescription: string | null;
  capturedAt: string | null;
  createdAt: string;
}

export interface BillingStatus {
  subscriptionId: string;
  plan: { id: string; name: string };
  billingCycle: "monthly" | "annual";
  amountPaise: number;
  currency: "INR";
  status: string;
  accessAllowed: boolean;
  billingModel: string;
  /** ACTIVATION before the first payment, RENEWAL afterwards. */
  purpose: "ACTIVATION" | "RENEWAL";
  activatedAt: string | null;
  currentPeriodStart: string | null;
  expiresAt: string | null;
  daysRemaining: number;
  lastPaymentAt: string | null;
  /** False when the plan is already paid beyond the next renewal window. */
  canPay: boolean;
  payBlockedReason: string | null;
  openOrder: {
    orderId: string;
    razorpayOrderId: string;
    purpose: string;
    amountPaise: number;
    createdAt: string;
  } | null;
  hasLegacyRecurringSubscription: boolean;
  paymentHistory: BillingPayment[];
}

/** Response of POST /subscriptions/orders. The amount is decided by the server. */
export interface CheckoutOrder {
  orderId: string;
  razorpayOrderId: string;
  keyId: string;
  amount: number;
  currency: "INR";
  planId: string;
  planName: string;
  billingCycle: "monthly" | "annual";
  purpose: "ACTIVATION" | "RENEWAL";
  reused: boolean;
  /** Hosted checkout page for native apps (no Razorpay SDK required). */
  hostedCheckoutUrl: string;
}

export interface VerifyResult {
  verified: true;
  state: "APPLIED" | "ALREADY_APPLIED" | "PENDING" | "FAILED" | "REJECTED";
  message: string;
  activated: boolean;
  status: string;
  expiresAt: string | null;
}

export interface RazorpayOrderCheckoutResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

// Owner-only; the only endpoints reachable while the subscription is inactive.
export const billingApi = {
  status: () => call(api.get<BillingStatus>("/subscriptions/status")),
  /** Creates or reuses a one-time order. Plan/cycle are optional (saved ones are used). */
  createOrder: (selection?: { planId?: string; billingCycle?: string }) =>
    call(api.post<CheckoutOrder>("/subscriptions/orders", selection ?? {})),
  /** Re-reads open orders from Razorpay; webhook independent. */
  refresh: () => call(api.post<BillingStatus>("/subscriptions/refresh")),
  verify: (response: RazorpayOrderCheckoutResponse) =>
    call(
      api.post<VerifyResult>("/subscriptions/payments/verify", {
        razorpayOrderId: response.razorpay_order_id,
        razorpayPaymentId: response.razorpay_payment_id,
        razorpaySignature: response.razorpay_signature,
      }),
    ),
};
