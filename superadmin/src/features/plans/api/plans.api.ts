import { pendingEndpoints } from '../../../core/api/endpoints';
import { AppError } from '../../../core/api/api-error';
import { run } from '../../../core/data/source';
import { previewAudit, previewDb, previewId } from '../../../core/data/previewStore';
import { limitViolations } from '../../../core/domain/subscription';
import type { Plan } from '../types';
import type { PlanValues } from '../schemas/plan.schema';

function toPlan(base: Pick<Plan, 'id'>, v: PlanValues): Plan {
  return {
    id: base.id,
    name: v.name,
    monthly: v.monthly,
    annual: v.annual,
    limits: { employees: v.employees, branches: v.branches, companies: v.companies, users: v.users },
    trialDays: v.trialDays,
    enabled: v.enabled,
    description: v.description,
    features: { crm: v.crm, people: v.people, payroll: v.payroll, reports: v.reports },
  };
}

/** Plans have no backend module yet; every call names the endpoint it needs. */
export const plansApi = {
  list: () =>
    run<Plan[]>({ requiredEndpoint: pendingEndpoints.listPlans, preview: () => structuredClone(previewDb().plans) }),

  update: (id: string, values: PlanValues) =>
    run<Plan>({
      requiredEndpoint: pendingEndpoints.updatePlan,
      preview: () => {
        const db = previewDb();
        const index = db.plans.findIndex((p) => p.id === id);
        if (index < 0) throw new AppError('not_found', 'This plan no longer exists.');
        const next = toPlan({ id }, values);
        // APK rule: existing subscribers must still fit the edited limits.
        for (const c of db.customers.filter((x) => x.subscription?.planId === id)) {
          const over = c.usage ? limitViolations(c.usage, next.limits) : [];
          if (over.length) throw new AppError('validation', c.name + ' is above the new limits: ' + over.join(', '));
        }
        db.plans[index] = next;
        previewAudit('Subscription plan updated', next.name);
        return structuredClone(next);
      },
    }),

  /** Not in the APK (it only edits plans). Required by the project brief. */
  create: (values: PlanValues) =>
    run<Plan>({
      requiredEndpoint: pendingEndpoints.createPlan,
      preview: () => {
        const db = previewDb();
        if (db.plans.some((p) => p.name.toLowerCase() === values.name.toLowerCase()))
          throw new AppError('validation', 'A plan with this name already exists.');
        const plan = toPlan({ id: previewId('plan') }, values);
        db.plans.push(plan);
        previewAudit('Subscription plan created', plan.name);
        return structuredClone(plan);
      },
    }),
};
