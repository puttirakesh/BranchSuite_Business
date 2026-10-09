import type { CrmRecord, EntityKind, QuoteItem, RecordInput } from '../types';
import { dateError, decimalError, emailError, identifierError, inputLimits, phoneError, supportedCurrencies, textError } from './validation';

export const crmConfig = {
  leads: { singular: 'lead', title: 'Leads', description: 'Turn new interest into lasting relationships.', statuses: ['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST'] },
  contacts: { singular: 'contact', title: 'Contacts', description: 'The people behind your business relationships.', statuses: ['ACTIVE', 'INACTIVE'] },
  customers: { singular: 'customer', title: 'Customers', description: 'Keep every customer relationship in view.', statuses: ['ACTIVE', 'INACTIVE'] },
  deals: { singular: 'deal', title: 'Deals', description: 'Move opportunities from first conversation to won.', statuses: ['OPEN', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'] },
  quotes: { singular: 'quote', title: 'Quotes', description: 'Create clear proposals for your customers.', statuses: ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED'] },
} as const;
export type Draft = Record<string, string>;
export interface ItemDraft { description: string; quantity: string; unitPrice: string }
export function initialDraft(kind: EntityKind, record?: CrmRecord): Draft {
  return {
    name: record?.name ?? '', status: record?.status ?? crmConfig[kind].statuses[0], email: record?.email ?? '', phone: record?.phone ?? '',
    organization: record?.organization ?? '', source: record?.source ?? '', notes: record?.notes ?? '', contactId: record?.contactId ?? '',
    customerId: record?.customerId ?? '', amount: record?.amount?.toString() ?? '', currency: record?.currency ?? 'INR',
    expectedCloseDate: record?.expectedCloseDate?.slice(0, 10) ?? '', validUntil: record?.validUntil?.slice(0, 10) ?? '', taxRate: record?.taxRate?.toString() ?? '0',
  };
}
export function validateDraft(kind: EntityKind, draft: Draft, items: ItemDraft[]): { input?: RecordInput; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const check = (key: string, error: string | undefined) => { if (error) errors[key] = error; };
  check('name', textError(draft.name, 'Name', inputLimits.name, true));
  check('notes', textError(draft.notes, 'Notes', inputLimits.notes, false, true));
  if (!(crmConfig[kind].statuses as readonly string[]).includes(draft.status)) errors.status = 'Choose a valid status.';
  const input: RecordInput = { name: draft.name.trim(), status: draft.status, notes: draft.notes.trim() };
  if (['leads', 'contacts', 'customers'].includes(kind)) {
    check('email', emailError(draft.email));
    check('phone', phoneError(draft.phone));
    check('organization', textError(draft.organization, 'Organization', inputLimits.organization));
    Object.assign(input, { email: draft.email.trim(), phone: draft.phone.trim(), organization: draft.organization.trim() });
  }
  if (kind === 'leads') { check('source', textError(draft.source, 'Lead source', inputLimits.source)); input.source = draft.source.trim(); }
  if (kind === 'customers') { check('contactId', identifierError(draft.contactId, 'contact')); input.contactId = draft.contactId || null; }
  if (kind === 'deals' || kind === 'quotes') {
    input.customerId = draft.customerId || null;
    check('customerId', identifierError(draft.customerId, 'customer', kind === 'quotes'));
    if (kind === 'quotes' && !draft.customerId) errors.customerId = 'Choose a customer.';
    input.currency = draft.currency.trim().toUpperCase();
    check('currency', textError(draft.currency, 'Currency', 32, true));
    if (!(supportedCurrencies as readonly string[]).includes(input.currency)) errors.currency = `Choose a supported currency: ${supportedCurrencies.join(', ')}.`;
    const dateKey = kind === 'deals' ? 'expectedCloseDate' : 'validUntil';
    check(dateKey, dateError(draft[dateKey]));
    input[dateKey] = draft[dateKey].trim() || null;
  }
  if (kind === 'deals') {
    check('amount', decimalError(draft.amount, 'Deal value', inputLimits.money, 2));
    input.amount = Number(draft.amount.trim());
  }
  if (kind === 'quotes') {
    if (items.length === 0) errors.items = 'Add at least one line item.';
    if (items.length > inputLimits.items) errors.items = `Use at most ${inputLimits.items} line items.`;
    input.items = items.map((item, index) => {
      check(`items.${index}.description`, textError(item.description, 'Description', inputLimits.description, true));
      check(`items.${index}.quantity`, decimalError(item.quantity, 'Quantity', inputLimits.quantity, 3, true));
      check(`items.${index}.unitPrice`, decimalError(item.unitPrice, 'Unit price', inputLimits.money, 2));
      const quantity = Number(item.quantity.trim()); const unitPrice = Number(item.unitPrice.trim());
      return { description: item.description.trim(), quantity, unitPrice };
    });
    check('taxRate', decimalError(draft.taxRate, 'Tax', 100, 2));
    input.taxRate = Number(draft.taxRate.trim());
    if (Object.keys(errors).some((key) => key.startsWith('items.'))) errors.items ??= 'Check the highlighted line item fields.';
    if (!errors.items && !errors.taxRate) {
      const totals = quoteTotals(input.items, input.taxRate);
      if (!Number.isFinite(totals.total) || totals.total > inputLimits.money) errors.items = 'The quote total is too large. Reduce quantities or prices.';
    }
  }
  return Object.keys(errors).length ? { errors } : { input, errors };
}
export function quoteTotals(items: QuoteItem[], taxRate: number) {
  const subtotal = items.reduce((sum, item) => sum + Math.round(item.quantity * item.unitPrice * 100), 0) / 100;
  const tax = Math.round(subtotal * taxRate) / 100;
  return { subtotal, tax, total: Math.round((subtotal + tax) * 100) / 100 };
}
