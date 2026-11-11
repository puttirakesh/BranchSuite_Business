import type { CheckoutSession, RazorpayCheckoutResponse } from "./billing.api";

/**
 * Razorpay Standard Checkout for SUBSCRIPTIONS (web) plus bounded polling.
 *
 * - Subscriptions authorise through `subscription_id` (NOT `order_id`/`amount`):
 *   the plan amount is fixed by the subscription on the server.
 * - A success callback is never treated as proof of payment. It is forwarded to
 *   the backend (`/subscriptions/verify`), which checks the signature and asks
 *   Razorpay; access starts only when the backend reports ACTIVE.
 * - Native apps open Razorpay's hosted subscription link in the system browser
 *   (works in Expo Go and dev builds; no native SDK / production build needed)
 *   and complete through the backend's reconcile endpoint.
 */

export const RAZORPAY_CHECKOUT_SCRIPT =
  "https://checkout.razorpay.com/v1/checkout.js";

export type CheckoutOutcome =
  | { outcome: "success"; response: RazorpayCheckoutResponse }
  | { outcome: "dismissed" }
  | { outcome: "failed"; message: string };

export interface WebCheckoutOptions {
  key: string;
  subscription_id: string;
  name: string;
  description: string;
  theme: { color: string };
  handler: (response: RazorpayCheckoutResponse) => void;
  modal: { ondismiss: () => void; confirm_close: boolean };
  prefill?: { name?: string; email?: string };
  [extra: string]: unknown;
}

/** Builds Standard Checkout options. Deliberately contains no amount/order_id. */
export function buildWebCheckoutOptions(
  session: Pick<CheckoutSession, "keyId" | "razorpaySubscriptionId" | "plan" | "billingCycle">,
  handlers: {
    onSuccess: (response: RazorpayCheckoutResponse) => void;
    onDismiss: () => void;
  },
  prefill?: { name?: string; email?: string },
): WebCheckoutOptions {
  return {
    key: session.keyId,
    subscription_id: session.razorpaySubscriptionId,
    name: "BranchSuite Business",
    description: `${session.plan.name} plan · ${session.billingCycle === "annual" ? "Annual" : "Monthly"}`,
    theme: { color: "#3157D5" },
    handler: handlers.onSuccess,
    modal: { ondismiss: handlers.onDismiss, confirm_close: true },
    ...(prefill ? { prefill } : {}),
  };
}

/** True when the response has every field Razorpay documents for a subscription checkout. */
export function isCompleteCheckoutResponse(
  value: unknown,
): value is RazorpayCheckoutResponse {
  if (typeof value !== "object" || value === null) return false;
  const response = value as Record<string, unknown>;
  return (
    typeof response.razorpay_payment_id === "string" &&
    /^pay_/.test(response.razorpay_payment_id) &&
    typeof response.razorpay_subscription_id === "string" &&
    /^sub_/.test(response.razorpay_subscription_id) &&
    typeof response.razorpay_signature === "string" &&
    response.razorpay_signature.length > 0
  );
}

interface RazorpayInstance {
  open: () => void;
  on: (
    event: "payment.failed",
    callback: (failure: { error?: { description?: string } }) => void,
  ) => void;
}
type RazorpayConstructor = new (options: WebCheckoutOptions) => RazorpayInstance;

let scriptPromise: Promise<RazorpayConstructor> | null = null;

/** Loads checkout.js once (web only). Rejects if blocked or offline. */
export function loadRazorpayScript(): Promise<RazorpayConstructor> {
  const host = globalThis as unknown as {
    Razorpay?: RazorpayConstructor;
    document?: Document;
  };
  if (host.Razorpay) return Promise.resolve(host.Razorpay);
  if (!host.document) {
    return Promise.reject(new Error("Razorpay checkout is only available in a browser."));
  }
  if (scriptPromise) return scriptPromise;
  const documentRef = host.document;
  scriptPromise = new Promise<RazorpayConstructor>((resolve, reject) => {
    const script = documentRef.createElement("script");
    script.src = RAZORPAY_CHECKOUT_SCRIPT;
    script.async = true;
    script.onload = () => {
      const constructor = (globalThis as unknown as { Razorpay?: RazorpayConstructor }).Razorpay;
      if (constructor) resolve(constructor);
      else reject(new Error("Razorpay checkout did not initialise."));
    };
    script.onerror = () => {
      script.remove();
      reject(new Error("Could not load Razorpay checkout. Check your connection or ad-blocker."));
    };
    documentRef.head.appendChild(script);
  }).catch((error: unknown) => {
    scriptPromise = null; // allow a retry
    throw error;
  });
  return scriptPromise;
}

/** Opens Standard Checkout and resolves with exactly one outcome. */
export async function openWebCheckout(
  session: CheckoutSession,
  prefill?: { name?: string; email?: string },
): Promise<CheckoutOutcome> {
  const Razorpay = await loadRazorpayScript();
  return new Promise<CheckoutOutcome>((resolve) => {
    let settled = false;
    const settle = (outcome: CheckoutOutcome) => {
      if (settled) return;
      settled = true;
      resolve(outcome);
    };
    const instance = new Razorpay(
      buildWebCheckoutOptions(
        session,
        {
          onSuccess: (response) =>
            settle(
              isCompleteCheckoutResponse(response)
                ? { outcome: "success", response }
                : { outcome: "failed", message: "Razorpay returned an incomplete payment response." },
            ),
          onDismiss: () => settle({ outcome: "dismissed" }),
        },
        prefill,
      ),
    );
    instance.on("payment.failed", (failure) =>
      settle({
        outcome: "failed",
        message: failure.error?.description || "The payment was not completed.",
      }),
    );
    instance.open();
  });
}

export interface PollOptions<T> {
  /** One reconcile + read. */
  step: () => Promise<T>;
  done: (value: T) => boolean;
  attempts?: number;
  intervalMs?: number;
  sleep?: (ms: number) => Promise<void>;
  shouldStop?: () => boolean;
}

export type PollResult<T> =
  | { state: "done"; value: T }
  | { state: "timeout"; value: T | undefined }
  | { state: "cancelled"; value: T | undefined };

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Bounded polling: at most `attempts` provider reconciles, never an endless
 * loop. Transient failures are tolerated until the budget is exhausted.
 */
export async function pollUntil<T>({
  step,
  done,
  attempts = 12,
  intervalMs = 5000,
  sleep = defaultSleep,
  shouldStop = () => false,
}: PollOptions<T>): Promise<PollResult<T>> {
  let last: T | undefined;
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (shouldStop()) return { state: "cancelled", value: last };
    try {
      last = await step();
      if (done(last)) return { state: "done", value: last };
    } catch {
      // Slow or failing network: keep trying within the bounded budget.
    }
    if (attempt < attempts - 1) await sleep(intervalMs);
  }
  return { state: "timeout", value: last };
}

/** Best explanation of the most recent failed payment attempt, if any. */
export function lastFailureMessage(
  history: { status: string; failureDescription: string | null; failureCode: string | null }[],
): string | null {
  const failed = history.find((payment) => payment.status === "FAILED");
  if (!failed) return null;
  return failed.failureDescription || failed.failureCode || "The last payment attempt failed.";
}
