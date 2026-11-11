import type { Prisma } from "@prisma/client";
import { SUBSCRIPTION_PLANS } from '../modules/subscriptions/subscription-catalog';

/**
 * Single source of truth for "may this tenant use the paid business workspace?".
 * Used by JwtAuthGuard, BusinessAdminGuard and the session payload returned to
 * the clients, so the three can never disagree.
 */

export type SubscriptionAccessReason =
  | 'ACTIVE'
  | 'MISSING'
  | 'INVALID_PLAN'
  | 'NOT_ACTIVE'
  | 'PERIOD_ENDED'
  | 'NO_EXPIRY'
  | 'LEGACY_BYPASS';

export interface SubscriptionAccessRecord {
  planId: string;
  status: string;
  expiresAt: Date | null;
  currentPeriodEnd: Date | null;
  /** PREPAID (one-time orders) or RECURRING (legacy). Absent => legacy rules. */
  billingModel?: string | null;
}

export interface SubscriptionAccessDecision {
  allowed: boolean;
  reason: SubscriptionAccessReason;
}

/**
 * Tenants created before subscriptions existed have no row. The default is to
 * fail closed. A deployment that still hosts such tenants may opt in
 * explicitly; this must never be enabled for new environments.
 */
export function legacyTenantsWithoutSubscriptionAllowed(): boolean {
  return process.env.ALLOW_LEGACY_TENANTS_WITHOUT_SUBSCRIPTION === 'true';
}

export function evaluateSubscriptionAccess(
  subscription: SubscriptionAccessRecord | null | undefined,
  now: number = Date.now(),
): SubscriptionAccessDecision {
  if (!subscription) {
    return legacyTenantsWithoutSubscriptionAllowed()
      ? { allowed: true, reason: 'LEGACY_BYPASS' }
      : { allowed: false, reason: 'MISSING' };
  }
  if (!Object.hasOwn(SUBSCRIPTION_PLANS, subscription.planId)) {
    return { allowed: false, reason: 'INVALID_PLAN' };
  }
  if (subscription.status !== 'ACTIVE') {
    return { allowed: false, reason: 'NOT_ACTIVE' };
  }
  // Prepaid access is defined by an explicit paid-until instant: ACTIVE without
  // one is never trusted (fail closed).
  if (
    subscription.billingModel === 'PREPAID' &&
    !subscription.expiresAt &&
    !subscription.currentPeriodEnd
  ) {
    return { allowed: false, reason: 'NO_EXPIRY' };
  }
  if (
    (subscription.expiresAt && subscription.expiresAt.getTime() <= now) ||
    (subscription.currentPeriodEnd &&
      subscription.currentPeriodEnd.getTime() <= now)
  ) {
    return { allowed: false, reason: 'PERIOD_ENDED' };
  }
  return { allowed: true, reason: 'ACTIVE' };
}

export const SUBSCRIPTION_REQUIRED_MESSAGE =
  'An active paid subscription is required to access this business workspace.';

export interface SessionSubscription {
  /** Local subscription status, or MISSING when the tenant has no record. */
  status: string;
  planId: string | null;
  billingCycle: string | null;
  accessAllowed: boolean;
  /** Only the business owner may pay for / manage the subscription. */
  canManageBilling: boolean;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  /** Paid-until instant (ISO) for the expiry/renewal screens; null if never paid. */
  expiresAt: string | null;
  billingModel: string | null;
}

/**
 * Compact subscription summary included in the login and /auth/me session so
 * clients can route before calling any guarded business API. It is advisory UI
 * state only: every protected endpoint still enforces the subscription on the
 * server through JwtAuthGuard / BusinessAdminGuard.
 */
export async function sessionSubscription(
  db: Pick<Prisma.TransactionClient, "businessSubscription">,
  tenantId: string,
  roles: string[],
): Promise<SessionSubscription> {
  const record = await db.businessSubscription.findUnique({
    where: { tenantId },
    select: {
      planId: true,
      billingCycle: true,
      status: true,
      expiresAt: true,
      currentPeriodEnd: true,
      cancelAtPeriodEnd: true,
      billingModel: true,
    },
  });
  return {
    status: record?.status ?? 'MISSING',
    planId: record?.planId ?? null,
    billingCycle: record?.billingCycle ?? null,
    accessAllowed: evaluateSubscriptionAccess(record).allowed,
    canManageBilling: roles.includes('BUSINESS_OWNER'),
    cancelAtPeriodEnd: record?.cancelAtPeriodEnd ?? false,
    currentPeriodEnd: record?.currentPeriodEnd?.toISOString() ?? null,
    expiresAt: (() => {
      const ends = [record?.expiresAt, record?.currentPeriodEnd].filter(
        (value): value is Date => value instanceof Date,
      );
      return ends.length
        ? new Date(Math.min(...ends.map((value) => value.getTime()))).toISOString()
        : null;
    })(),
    billingModel: record?.billingModel ?? null,
  };
}
