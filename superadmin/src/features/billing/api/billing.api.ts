import { endpoints } from '../../../core/api/endpoints';
import { http } from '../../../core/api/client';
import { AppError } from '../../../core/api/api-error';
import { dateOnly, titleCase, toNumber } from '../../../core/api/mappers';
import { matches, pageOf, type ListQuery, type Page } from '../../../core/api/types';
import { run } from '../../../core/data/source';
import { previewDb } from '../../../core/data/previewStore';
import { today } from '../../../core/domain/dates';
import type { BillingSummary, Invoice } from '../types';

/** Shape of BillingInvoice (backend/prisma/schema.prisma) as returned by platform-billing.service.ts */
interface BackendInvoice {
  id: string;
  invoiceNumber: string;
  tenantId: string;
  status: string;
  amount: string;
  currency: string;
  description?: string;
  issuedAt?: string;
  dueAt?: string | null;
  paidAt?: string | null;
  paymentNote?: string | null;
  tenant?: { id: string; name: string } | null;
}

function mapStatus(raw: BackendInvoice): string {
  if (raw.paidAt || raw.status === 'PAID') return 'Paid';
  if (raw.status === 'ISSUED' && raw.dueAt && dateOnly(raw.dueAt)! < today()) return 'Overdue';
  return titleCase(raw.status);
}

function mapInvoice(raw: BackendInvoice): Invoice {
  return {
    id: raw.id,
    number: raw.invoiceNumber,
    customerId: raw.tenantId,
    customerName: raw.tenant?.name ?? null,
    customerEmail: null,
    planName: null,
    cycle: null,
    subtotal: null,
    discount: null,
    amount: toNumber(raw.amount),
    currency: raw.currency,
    status: mapStatus(raw),
    issuedOn: dateOnly(raw.issuedAt),
    dueOn: dateOnly(raw.dueAt),
    paidOn: dateOnly(raw.paidAt),
    reference: raw.paymentNote ?? null,
    description: raw.description ?? null,
  };
}

export interface InvoiceQuery extends ListQuery {
  customerId?: string;
  /** Issued on or after (YYYY-MM-DD). */
  from?: string;
  /** Issued on or before (YYYY-MM-DD). */
  to?: string;
}

export const billingApi = {
  list: (query: InvoiceQuery) =>
    run<Page<Invoice>>({
      preview: () =>
        pageOf(
          previewDb().invoices.filter(
            (i) =>
              (!query.customerId || i.customerId === query.customerId) &&
              (!query.status || i.status === query.status) &&
              (!query.from || (i.issuedOn ?? '') >= query.from) &&
              (!query.to || (i.issuedOn ?? '') <= query.to) &&
              matches(query.search, i.number, i.customerName, i.status),
          ),
          query,
        ),
      api: async () => {
        const res = await http.get<Page<BackendInvoice>>(endpoints.billing.invoices, {
          search: query.search || undefined,
          tenantId: query.customerId,
          status: query.status?.toUpperCase(),
          from: query.from,
          to: query.to,
          page: query.page ?? 1,
          limit: query.limit ?? 50,
        });
        return { ...res, items: res.items.map(mapInvoice) };
      },
    }),

  get: (id: string) =>
    run<Invoice>({
      preview: () => {
        const found = previewDb().invoices.find((i) => i.id === id);
        if (!found) throw new AppError('not_found', 'This invoice no longer exists.');
        return structuredClone(found);
      },
      api: async () => mapInvoice(await http.get<BackendInvoice>(endpoints.billing.invoice(id))),
    }),

  summary: () =>
    run<BillingSummary>({
      preview: () => {
        const rows = previewDb().invoices;
        const sum = (status: string) => rows.filter((i) => i.status === status).reduce((n, i) => n + i.amount, 0);
        return { paid: sum('Paid'), outstanding: sum('Unpaid'), currency: 'INR' };
      },
      api: async () => {
        const res = await http.get<{ currencies: { currency: string; byStatus: { status: string; amount: string }[] }[] }>(
          endpoints.billing.summary,
        );
        const inr = res.currencies.find((c) => c.currency === 'INR') ?? res.currencies[0];
        const amount = (status: string) => toNumber(inr?.byStatus.find((b) => b.status === status)?.amount);
        return { paid: amount('PAID'), outstanding: amount('ISSUED'), currency: inr?.currency ?? 'INR' };
      },
    }),
};
