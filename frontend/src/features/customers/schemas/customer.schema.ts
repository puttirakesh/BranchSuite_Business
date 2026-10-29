import { z } from 'zod';
export const subscriptionSchema = z.object({ planId: z.string().min(1), status: z.enum(['Active','Trial','Past due','Expired','Suspended','Cancelled']), cycle: z.enum(['Monthly','Annual']), renewOn: z.iso.date(), trialEndsOn: z.iso.date() });
