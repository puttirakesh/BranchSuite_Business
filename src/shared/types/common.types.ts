import type { Account, Session } from '../../core/auth/auth.types';
import type { Customer } from '../../features/customers/types';
import type { Plan } from '../../features/plans/types';
import type { Invoice } from '../../features/billing/types';
import type { Ticket } from '../../features/support/types';
import type { Offer, Campaign } from '../../features/offers/types';
import type { Prospect } from '../../features/marketing/types';
export interface AuditEntry { id: string; action: string; detail: string; actor: string; time: string; }
export interface PlatformSettings { brand: string; supportEmail: string; trialEnabled: boolean; billingNote: string; }
export interface Database { schema: number; session: Session | null; accounts: Account[]; tenants: Customer[]; plans: Plan[]; subscriptionInvoices: Invoice[]; saasTickets: Ticket[]; saasLeads: Prospect[]; coupons: Offer[]; campaigns: Campaign[]; platformSettings: PlatformSettings; saasAudit: AuditEntry[]; }
export type StorageSnapshot = Record<string, string>;
