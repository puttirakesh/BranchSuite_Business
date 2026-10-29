import { z } from 'zod';
export const planSchema = z.object({ name: z.string().trim().min(1), monthly: z.number().int().min(0), annual: z.number().int().min(0), employees: z.number().int().positive(), branches: z.number().int().positive(), companies: z.number().int().positive(), users: z.number().int().positive(), trialDays: z.number().int().positive() });
