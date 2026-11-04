import { z } from 'zod';
import { TICKET_PRIORITIES, TICKET_STATUSES } from '../types';

/** Backend CreatePlatformTicketReplyDto: 1-3000 characters after trimming. */
export const replySchema = z.object({
  message: z.string().trim().min(1, 'Enter a reply').max(3000, 'Keep replies under 3000 characters'),
  visibility: z.enum(['Customer reply', 'Internal note']),
  status: z.enum(TICKET_STATUSES),
  priority: z.enum(TICKET_PRIORITIES),
});
export type ReplyForm = z.infer<typeof replySchema>;
