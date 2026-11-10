import { z } from 'zod';
import { isValidIsoDate, today } from '../../../core/domain/dates';
import { CAMPAIGN_CHANNELS, CAMPAIGN_STATUSES } from '../types';

/** Mirrors saas-model.js `editCoupon`. `minUses` keeps the limit above completed redemptions. */
export function offerSchema(minUses = 0, onDate = today(), discountType: 'PERCENT' | 'FIXED' = 'PERCENT') {
  return z.object({
    code: z
      .string()
      .trim()
      .transform((v) => v.toUpperCase())
      .pipe(z.string().regex(/^[A-Z0-9_-]{3,20}$/, 'Use 3-20 letters, numbers, - or _')),
    percent: discountType === 'FIXED' ? z.coerce.number().min(0.01).max(9999999999) : z.coerce.number({ invalid_type_error: 'Enter a number' }).int('Use a whole percentage').min(1, 'At least 1%').max(100, 'At most 100%'),
    maxUses: z.coerce
      .number({ invalid_type_error: 'Enter a number' })
      .int('Use a whole number')
      .min(Math.max(1, minUses), minUses > 0 ? 'Limit cannot be below ' + minUses + ' completed uses' : 'At least 1 use'),
    startsOn: z.string().refine(isValidIsoDate, 'Choose a valid start date').optional(),
    expiresOn: z
      .string()
      .trim()
      .refine(isValidIsoDate, 'Use a valid date in YYYY-MM-DD format')
      .refine((v) => v >= onDate, 'Choose today or a future date'),
    enabled: z.boolean(),
  }).refine(v => !v.startsOn || v.expiresOn >= v.startsOn, { path: ['expiresOn'], message: 'Expiry must be on or after start date' });
}
export type OfferForm = z.input<ReturnType<typeof offerSchema>>;
export type OfferValues = z.output<ReturnType<typeof offerSchema>>;

export const campaignSchema = z.object({
  name: z.string().trim().min(1, 'Enter a campaign name').max(120),
  channel: z.enum(CAMPAIGN_CHANNELS),
  offerCode: z.string(),
  status: z.enum(CAMPAIGN_STATUSES),
  startsOn: z.string().refine(v => !v || isValidIsoDate(v), 'Choose a valid start date').optional(),
  endsOn: z.string().refine(v => !v || isValidIsoDate(v), 'Choose a valid end date').optional(),
  notes: z.string().max(1000, 'Keep notes under 1000 characters'),
}).refine(v => !v.startsOn || !v.endsOn || v.endsOn >= v.startsOn, { path: ['endsOn'], message: 'End must be on or after start date' });
export type CampaignForm = z.infer<typeof campaignSchema>;
