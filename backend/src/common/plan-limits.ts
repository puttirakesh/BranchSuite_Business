import { ForbiddenException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { SUBSCRIPTION_PLANS } from '../modules/subscriptions/subscription-catalog';

export type PlanResource = 'companies' | 'branches' | 'employees' | 'users';
type Limits = Record<PlanResource, number>;

// "users" counts active staff with a business (non-Employee) role.
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
  // Tenants created before subscriptions existed have no plan and are not limited.
  return subscription ? PLAN_LIMITS[subscription.planId] ?? null : null;
}

/** Throws when adding `adding` more of `resource` would exceed the tenant's plan. */
export async function assertPlanCapacity(db: Db, tenantId: string, resource: PlanResource, adding = 1): Promise<void> {
  const limits = await planLimits(db, tenantId);
  if (!limits) return;
  const usage = await planUsage(db, tenantId);
  if (usage[resource] + adding > limits[resource]) {
    throw new ForbiddenException(`Your plan allows up to ${limits[resource]} ${LABELS[resource]}. Upgrade your plan to add more.`);
  }
}
