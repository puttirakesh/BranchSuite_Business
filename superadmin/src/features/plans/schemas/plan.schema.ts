import { z } from 'zod';

const price = z.coerce.number({ invalid_type_error: 'Enter a number' }).int('Use whole rupees').min(0, 'Price cannot be negative');
const limit = z.coerce.number({ invalid_type_error: 'Enter a number' }).int('Use a whole number').min(1, 'Must be at least 1');

/** Mirrors saas-model.js `editPlan`: non-negative whole prices, positive whole limits. */
export const planSchema = z.object({
  name: z.string().trim().min(1, 'Enter a plan name').max(60),
  monthly: price,
  annual: price,
  employees: limit,
  branches: limit,
  companies: limit,
  users: limit,
  trialDays: limit,
  description: z.string().trim().max(240),
  crm: z.boolean(),
  people: z.boolean(),
  payroll: z.boolean(),
  reports: z.boolean(),
  enabled: z.boolean(),
});
export type PlanForm = z.input<typeof planSchema>;
export type PlanValues = z.output<typeof planSchema>;
