import { z } from 'zod';
import { isValidIsoDate } from '../../../core/domain/dates';
import { PROSPECT_STAGES } from '../types';

/** Mirrors saas-model.js `editLead`. */
export const followUpSchema = z.object({
  status: z.enum(PROSPECT_STAGES),
  followup: z.string().trim().refine(isValidIsoDate, 'Use a valid date in YYYY-MM-DD format'),
  notes: z.string().max(2000, 'Keep notes under 2000 characters'),
});
export type FollowUpForm = z.infer<typeof followUpSchema>;
