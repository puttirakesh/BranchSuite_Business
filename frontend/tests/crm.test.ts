import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initialDraft, quoteTotals, validateDraft } from '../src/utils/crm';
import { loginSchema, pageSchema } from '../src/types';

test('deals reject impossible calendar dates and negative values', () => {
  const draft = { ...initialDraft('deals'), name: 'Website', amount: '-1', expectedCloseDate: '2026-02-30' };
  const result = validateDraft('deals', draft, []);
  assert.ok(result.errors.amount); assert.ok(result.errors.expectedCloseDate); assert.equal(result.input, undefined);
});
test('optional dates and relationships can be cleared on edit', () => {
  const draft = { ...initialDraft('deals'), name: 'Website', amount: '1234.50' };
  const result = validateDraft('deals', draft, []);
  assert.deepEqual(result.errors, {}); assert.equal(result.input?.expectedCloseDate, null); assert.equal(result.input?.customerId, null); assert.equal(result.input?.amount, 1234.5);
});
test('quotes require a customer and valid line items', () => {
  const draft = { ...initialDraft('quotes'), name: 'Proposal' };
  assert.ok(validateDraft('quotes', draft, []).errors.customerId);
  assert.ok(validateDraft('quotes', { ...draft, customerId: 'customer-a' }, [{ description: 'Service', quantity: '0', unitPrice: '100' }]).errors.items);
});
test('quote totals round lines and tax to currency precision', () => {
  assert.deepEqual(quoteTotals([{ description: 'Service', quantity: 3, unitPrice: 0.1 }], 18), { subtotal: 0.3, tax: 0.05, total: 0.35 });
  const result = validateDraft('quotes', { ...initialDraft('quotes'), name: 'Proposal', customerId: 'a', taxRate: '18' }, [{ description: 'Service', quantity: '2', unitPrice: '100.50' }]);
  assert.deepEqual(result.errors, {}); assert.equal(result.input?.items?.[0].unitPrice, 100.5);
  assert.equal('total' in result.input!, false);
});
test('invalid CRM payloads and token-only login responses are rejected', () => {
  assert.equal(pageSchema.safeParse({ items: [{}], nextCursor: null }).success, false);
  assert.equal(loginSchema.safeParse({ accessToken: 'token' }).success, false);
});
