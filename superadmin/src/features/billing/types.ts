import type { BillingCycle } from '../../core/domain/subscription';

export type InvoiceStatus = 'Paid' | 'Unpaid' | 'Issued' | 'Overdue' | 'Cancelled' | string;

export interface Invoice {
  id: string;
  number: string;
  customerId: string;
  customerName: string | null;
  customerEmail: string | null;
  planName: string | null;
  cycle: BillingCycle | null;
  subtotal: number | null;
  discount: number | null;
  amount: number;
  currency: string;
  status: InvoiceStatus;
  issuedOn: string | null;
  dueOn: string | null;
  paidOn: string | null;
  reference: string | null;
  description: string | null;
}

export interface BillingSummary {
  paid: number;
  outstanding: number;
  currency: string;
}
