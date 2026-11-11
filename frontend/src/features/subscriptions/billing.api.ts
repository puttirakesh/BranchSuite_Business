import { api } from "../../core/api/client";
import { call } from "../../core/admin/http";

/** Mirrors backend SubscriptionsService.pendingCheckout / createCheckout / verifyCheckout. */
export interface BillingPayment {
  id: string;
  providerPaymentId: string;
  amountPaise: number;
  currency: string;
  status: string;
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
  providerStatus: string | null;
  accessAllowed: boolean;
  activatedAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  razorpaySubscriptionId: string | null;
  keyId: string | null;
  checkoutUrl: string | null;
  paymentHistory: BillingPayment[];
}

export interface CheckoutSession {
  subscriptionId: string;
  razorpaySubscriptionId: string;
  checkoutUrl: string | null;
  keyId: string;
  plan: { id: string; name: string };
  billingCycle: "monthly" | "annual";
  amountPaise: number;
  currency: "INR";
  status: string;
  providerStatus: string | null;
  reused: boolean;
}

export interface VerifyResult {
  verified: boolean;
  activated: boolean;
  status: string;
  providerStatus: string | null;
  activatedAt: string | null;
  message: string;
}

export interface RazorpayCheckoutResponse {
  razorpay_payment_id: string;
  razorpay_subscription_id: string;
  razorpay_signature: string;
}

// These endpoints are owner-only and are the only ones reachable while the
// subscription is inactive (backend @AllowPendingSubscription).
export const billingApi = {
  status: () => call(api.get<BillingStatus>("/subscriptions/status")),
  pending: () => call(api.get<BillingStatus>("/subscriptions/pending")),
  /** Creates the Razorpay subscription, or returns the existing reusable one. */
  checkout: () => call(api.post<CheckoutSession>("/subscriptions/checkout")),
  /** Asks the backend to reconcile with Razorpay (does not trust the client). */
  refresh: () => call(api.post<BillingStatus>("/subscriptions/refresh")),
  verify: (response: RazorpayCheckoutResponse) =>
    call(
      api.post<VerifyResult>("/subscriptions/verify", {
        razorpayPaymentId: response.razorpay_payment_id,
        razorpaySubscriptionId: response.razorpay_subscription_id,
        razorpaySignature: response.razorpay_signature,
      }),
    ),
};
