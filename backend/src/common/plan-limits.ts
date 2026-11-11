import { ForbiddenException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { SUBSCRIPTION_PLANS } from '../modules/subscriptions/subscription-catalog';
import {
  legacyTenantsWithoutSubscriptionAllowed,
  SUBSCRIPTION_REQUIRED_MESSAGE,
} from './subscription-access';

export type PlanResource = 'companies' | 'branches' | 'employees' | 'users';
type Limits = Record<PlanResource, number>;

/**
 * Centralised entitlement source. Numeric limits come ONLY from the
 * subscription catalog (SUBSCRIPTION_PLANS), which is also what billing uses.
 * "users" counts active staff with a business (non-Employee) role.
 */
export const PLAN_LIMITS: Record<string, Limits> = Object.fromEntries(
  Object.values(SUBSCRIPTION_PLANS).map(({ id, limits }) => [id, limits]),
);

const LABELS: Record<PlanResource, string> = { companies: 'companies', branches: 'branches', employees: 'active employees', users: 'staff users' };

type Db = Prisma.TransactionClient;

export async function planUsage(db: Db, tenantId: string): Promise<Limits> {
  const [companies, branches, employees, users] = await Promise.all([
    db.company.count({ where: { tenantId, status: 'ACTIVE' } }),
    db.branch.count({ where: { company: { tenantId, status: 'ACTIVE' }, status: 'ACTIVE' } }),
    db.employeeProfile.count({ where: { tenantId, status: 'ACTIVE' } }),
    db.user.count({ where: { tenantId, status: 'ACTIVE', roles: { some: { role: { name: { not: 'EMPLOYEE' } } } } } }),
  ]);
  return { companies, branches, employees, users };
}

export async function planLimits(db: Db, tenantId: string): Promise<Limits | null> {
  const subscription = await db.businessSubscription.findUnique({ where: { tenantId }, select: { planId: true } });
  return subscription ? PLAN_LIMITS[subscription.planId] ?? null : null;
}

/** Structured 403 so clients can show a precise "plan limit reached" message. */
export class PlanLimitExceededException extends ForbiddenException {
  constructor(resource: PlanResource, limit: number, used: number) {
    super({
      statusCode: 403,
      error: 'Forbidden',
      code: 'PLAN_LIMIT_REACHED',
      resource,
      limit,
      used,
      message: `Your plan allows up to ${limit} ${LABELS[resource]}. Upgrade your plan to add more.`,
    });
  }
}

/**
 * Throws when adding `adding` more of `resource` would exceed the tenant's plan.
 *
 * Must run inside the same transaction as the write it protects. A per-tenant
 * transaction-scoped advisory lock serialises concurrent capacity checks, so two
 * simultaneous requests cannot both observe the last free seat.
 * Call it for every path that raises active usage: create AND reactivation.
 */
export async function assertPlanCapacity(db: Db, tenantId: string, resource: PlanResource, adding = 1): Promise<void> {
  if (typeof db.$executeRaw === 'function') {
    await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`plan-capacity:${tenantId}`})::bigint)`;
  }
  const limits = await planLimits(db, tenantId);
  if (!limits) {
    // No (or unrecognised) subscription: fail closed unless the explicit
    // legacy-tenant opt-in is enabled for this deployment.
    if (legacyTenantsWithoutSubscriptionAllowed()) return;
    throw new ForbiddenException(SUBSCRIPTION_REQUIRED_MESSAGE);
  }
  const usage = await planUsage(db, tenantId);
  if (usage[resource] + adding > limits[resource]) {
    throw new PlanLimitExceededException(resource, limits[resource], usage[resource]);
  }
}
