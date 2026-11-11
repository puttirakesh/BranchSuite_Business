import type { AuthSession } from "../../core/api/client";

/**
 * Subscription-aware routing decisions. Pure functions so that login, token
 * restoration, app start, browser refresh and deep links all share ONE rule.
 *
 * This is UI routing only. The backend remains the authority and independently
 * denies every protected API for an inactive subscription (HTTP 403).
 */

export type BillingReason =
  | "PENDING_ACTIVATION"
  | "PAST_DUE"
  | "EXPIRED"
  | "CANCELLED"
  | "MISSING"
  | "UNKNOWN";

export type SubscriptionAccess =
  | { kind: "allowed" }
  | { kind: "billing"; reason: BillingReason; canManageBilling: boolean };

export const BILLING_ROUTE = "/billing" as const;

const KNOWN_BILLING_STATUSES = new Set<string>([
  "PENDING_ACTIVATION",
  "PAST_DUE",
  "EXPIRED",
  "CANCELLED",
  "MISSING",
]);

export function subscriptionAccess(
  session: AuthSession | null | undefined,
): SubscriptionAccess {
  const subscription = session?.subscription;
  // Missing summary (older backend / malformed response): never grant silently.
  if (!subscription || typeof subscription.status !== "string") {
    return { kind: "billing", reason: "UNKNOWN", canManageBilling: false };
  }
  if (subscription.status === "ACTIVE" && subscription.accessAllowed === true) {
    return { kind: "allowed" };
  }
  const canManageBilling = subscription.canManageBilling === true;
  if (subscription.status === "ACTIVE") {
    // Active but the paid period has ended according to the backend.
    return { kind: "billing", reason: "EXPIRED", canManageBilling };
  }
  return {
    kind: "billing",
    reason: KNOWN_BILLING_STATUSES.has(subscription.status)
      ? (subscription.status as BillingReason)
      : "UNKNOWN",
    canManageBilling,
  };
}

export function isEmployeeOnly(session: AuthSession): boolean {
  return (
    session.memberships.length > 0 &&
    session.memberships.every((membership) => membership.role === "EMPLOYEE")
  );
}

/** Where a signed-in session belongs. */
export function workspaceHome(
  session: AuthSession,
): "/admin" | "/employee" | typeof BILLING_ROUTE {
  if (subscriptionAccess(session).kind !== "allowed") return BILLING_ROUTE;
  return isEmployeeOnly(session) ? "/employee" : "/admin";
}

export interface BillingCopy {
  title: string;
  message: string;
  /** Whether the owner can start / retry a payment from this state. */
  canPay: boolean;
  actionLabel: string;
}

/** Human wording for every billing state (owner view). */
export function billingCopy(reason: BillingReason): BillingCopy {
  switch (reason) {
    case "PENDING_ACTIVATION":
      return {
        title: "Activate your subscription",
        message:
          "Your account is created. Make a one-time payment to activate your plan and open your business workspace. Nothing renews automatically.",
        canPay: true,
        actionLabel: "Pay & Activate",
      };
    case "EXPIRED":
    case "PAST_DUE":
    case "CANCELLED":
      return {
        title: "Your BranchSuite subscription has expired.",
        message:
          "Your business data is safely retained. Renew your plan to restore access.",
        canPay: true,
        actionLabel: "Renew Plan",
      };
    case "MISSING":
      return {
        title: "No subscription found",
        message:
          "We could not find a subscription for this business. Please contact BranchSuite support.",
        canPay: false,
        actionLabel: "Refresh status",
      };
    default:
      return {
        title: "Unable to verify your subscription",
        message:
          "We could not confirm your subscription status, so access is paused for your safety. Refresh, or sign out and try again.",
        canPay: false,
        actionLabel: "Refresh status",
      };
  }
}

/** Message shown to non-owner roles of an inactive tenant. */
export const NON_OWNER_BILLING_MESSAGE =
  "Your business subscription is not active. Only the business owner can manage billing — please ask them to sign in and pay or renew the plan. Your business data is safely retained.";
