import { z } from 'zod';
import { BILLING_CYCLES, SUBSCRIPTION_STATES } from '../../../core/domain/subscription';
import { isValidIsoDate } from '../../../core/domain/dates';

const isoDate = z.string().trim().refine(isValidIsoDate, 'Use a valid date in YYYY-MM-DD format');

/** Mirrors saas-model.js `editSubscription` validation. */
export const subscriptionSchema = z.object({
  planId: z.string().min(1, 'Choose a plan'),
  cycle: z.enum(BILLING_CYCLES),
  status: z.enum(SUBSCRIPTION_STATES),
  renewOn: isoDate,
  trialEndsOn: isoDate,
});
export type SubscriptionForm = z.infer<typeof subscriptionSchema>;
