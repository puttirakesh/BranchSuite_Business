import { z } from 'zod';

export type UserRole = 'BUSINESS_OWNER' | 'BUSINESS_ADMIN' | 'MANAGER' | 'SALES' | 'HR' | 'PAYROLL' | 'EMPLOYEE';
export const entityKinds = ['leads', 'contacts', 'customers', 'deals', 'quotes'] as const;
export type EntityKind = typeof entityKinds[number];
export type Permission = 'dashboard:read' | `${EntityKind}:${'read' | 'create' | 'update' | 'delete'}`;
export const branchSchema = z.object({ id: z.string().min(1), name: z.string().min(1) });
export type Branch = z.infer<typeof branchSchema>;
export const membershipSchema = z.object({
  id: z.string().min(1), tenantId: z.string().min(1), companyId: z.string().min(1),
  companyName: z.string().min(1), role: z.string(), permissions: z.array(z.string()), branches: z.array(branchSchema),
});
export type Membership = z.infer<typeof membershipSchema>;
export const sessionSchema = z.object({
  user: z.object({ id: z.string().min(1), name: z.string().min(1), email: z.string().email() }),
  memberships: z.array(membershipSchema),
});
export type Session = z.infer<typeof sessionSchema>;
export const loginSchema = z.object({ accessToken: z.string().min(1), session: sessionSchema });
export interface Scope { tenantId: string; companyId: string; branchId: string; membershipId: string }
export const quoteItemSchema = z.object({ description: z.string(), quantity: z.number(), unitPrice: z.number() });
export type QuoteItem = z.infer<typeof quoteItemSchema>;
export const recordSchema = z.object({
  id: z.string().min(1), name: z.string(), status: z.string(), createdAt: z.string(),
  email: z.string().nullable().optional(), phone: z.string().nullable().optional(),
  organization: z.string().nullable().optional(), source: z.string().nullable().optional(), notes: z.string().nullable().optional(),
  contactId: z.string().nullable().optional(), customerId: z.string().nullable().optional(),
  amount: z.number().nullable().optional(), currency: z.string().optional(), expectedCloseDate: z.string().nullable().optional(),
  validUntil: z.string().nullable().optional(), items: z.array(quoteItemSchema).optional(), taxRate: z.number().optional(), total: z.number().optional(),
});
export type CrmRecord = z.infer<typeof recordSchema>;
export const pageSchema = z.object({ items: z.array(recordSchema), nextCursor: z.string().nullable() });
export const dashboardSchema = z.object({
  leads: z.number(), customers: z.number(), openDeals: z.number(), pipelineValue: z.number(), quotesAwaitingResponse: z.number(), currency: z.string(),
  recentActivity: z.array(z.object({ id: z.string(), title: z.string(), description: z.string(), createdAt: z.string() })),
});
export type Dashboard = z.infer<typeof dashboardSchema>;
export interface RecordInput {
  name: string; status: string; email?: string; phone?: string; organization?: string; source?: string; notes?: string;
  contactId?: string | null; customerId?: string | null; amount?: number; currency?: string;
  expectedCloseDate?: string | null; validUntil?: string | null; items?: QuoteItem[]; taxRate?: number;
}
