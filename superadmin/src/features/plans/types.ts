import type { Limits } from '../../core/domain/subscription';

export const PLAN_FEATURES = ['crm', 'people', 'payroll', 'reports'] as const;
export type PlanFeature = (typeof PLAN_FEATURES)[number];
export const featureLabel: Record<PlanFeature, string> = { crm: 'CRM', people: 'People', payroll: 'Payroll', reports: 'Reports' };

export interface Plan {
  id: string;
  name: string;
  monthly: number;
  annual: number;
  limits: Limits;
  trialDays: number;
  enabled: boolean;
  description: string;
  features: Record<PlanFeature, boolean>;
}
