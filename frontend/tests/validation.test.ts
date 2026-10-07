import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initialDraft, validateDraft } from '../src/utils/crm';
import { dateError, decimalError, emailError, inputLimits, phoneError, validateLogin, validateSearch } from '../src/utils/validation';

test('login identifies each invalid field and preserves a real password verbatim', () => {
  assert.deepEqual(Object.keys(validateLogin('', '').errors), ['email', 'password']);
  assert.ok(validateLogin('not-an-email', '   ').errors.password);
  assert.equal(validateLogin(' alex@example.com ', '  valid password  ').input?.password, '  valid password  ');
  assert.equal(validateLogin(' alex@example.com ', 'short').input?.email, 'alex@example.com');
  assert.ok(validateLogin('alex@example.com', 'x'.repeat(inputLimits.password + 1)).errors.password);
  assert.ok(validateLogin('alex@example.com', 'pass\u0000word').errors.password);
});
test('email and phone checks reject punctuation-only and misplaced plus signs', () => {
  for (const phone of ['.......', '123456', '1234567890123456', '91+9876543210', '++919876543210', '(9876543210', '( ) 9876543210', '1234567abc']) assert.ok(phoneError(phone), phone);
  for (const phone of ['', '   ', '+91 98765 43210', '(022) 1234-5678', '9876543210']) assert.equal(phoneError(phone), undefined, phone);
  assert.ok(emailError('bad@')); assert.equal(emailError(' user@example.com '), undefined);
  assert.ok(emailError(`${'x'.repeat(255)}@example.com`));
});
test('all textual CRM fields enforce their limits and control characters are rejected', () => {
  for (const [key, max] of Object.entries({ name: inputLimits.name, organization: inputLimits.organization, source: inputLimits.source, notes: inputLimits.notes })) {
    const draft = { ...initialDraft('leads'), name: 'Valid lead', [key]: 'x'.repeat(max + 1) };
    assert.ok(validateDraft('leads', draft, []).errors[key], key);
  }
  assert.ok(validateDraft('contacts', { ...initialDraft('contacts'), name: 'Name\u0000' }, []).errors.name);
  const valid = validateDraft('leads', { ...initialDraft('leads'), name: '  आरव & Sons  ', email: '   ', phone: '   ', notes: 'First line\nSecond line\twith tab' }, []);
  assert.deepEqual(valid.errors, {}); assert.equal(valid.input?.name, 'आरव & Sons');
});
test('relationship IDs and status selections are validated', () => {
  assert.ok(validateDraft('customers', { ...initialDraft('customers'), name: 'Acme', contactId: '   ' }, []).errors.contactId);
  assert.ok(validateDraft('customers', { ...initialDraft('customers'), name: 'Acme', status: 'WON' }, []).errors.status);
  assert.ok(validateDraft('deals', { ...initialDraft('deals'), name: 'Acme', amount: '100', customerId: 'x'.repeat(129) }, []).errors.customerId);
});
test('dates check leap years, actual calendar days and optional clearing', () => {
  for (const date of ['2026-02-29', '2026-13-01', '2026-04-31', '0000-01-01', '07/10/2026']) assert.ok(dateError(date), date);
  for (const date of ['', '  ', '2028-02-29', ' 2026-10-07 ']) assert.equal(dateError(date), undefined, date);
});
test('monetary, quantity and tax strings cannot use exponent or hexadecimal coercion', () => {
  for (const raw of ['NaN', 'Infinity', '0x10', '0b10', '1e2', '-1', '.5', '1.123', '1000000000001', '\t100']) assert.ok(decimalError(raw, 'Price', inputLimits.money, 2), raw);
  assert.equal(decimalError(' 10.50 ', 'Price', inputLimits.money, 2), undefined);
  assert.ok(decimalError('0', 'Quantity', inputLimits.quantity, 3, true));
  assert.equal(decimalError('0.125', 'Quantity', inputLimits.quantity, 3, true), undefined);
  assert.ok(decimalError('100.01', 'Tax', 100, 2));
});
test('currency codes are normalized and unsupported codes cannot be saved', () => {
  const draft = { ...initialDraft('deals'), name: 'Acme', amount: '100', currency: ' usd ' };
  assert.equal(validateDraft('deals', draft, []).input?.currency, 'USD');
  assert.ok(validateDraft('deals', { ...draft, currency: 'XYZ' }, []).errors.currency);
});
test('every invalid quote line field has its own error and excessive totals are rejected', () => {
  const draft = { ...initialDraft('quotes'), name: 'Quote', customerId: 'customer-a' };
  const invalid = validateDraft('quotes', { ...draft, taxRate: '1e1' }, [{ description: ' ', quantity: '0x10', unitPrice: '-1' }]);
  for (const key of ['items.0.description', 'items.0.quantity', 'items.0.unitPrice', 'taxRate']) assert.ok(invalid.errors[key], key);
  assert.equal(invalid.input, undefined);
  assert.ok(validateDraft('quotes', draft, [{ description: 'Service', quantity: '1000000', unitPrice: '1000000000000' }]).errors.items);
  assert.ok(validateDraft('quotes', draft, Array.from({ length: 101 }, () => ({ description: 'Service', quantity: '1', unitPrice: '1' }))).errors.items);
  assert.ok(validateDraft('quotes', draft, [{ description: 'x'.repeat(501), quantity: '1', unitPrice: '1' }]).errors['items.0.description']);
});
test('search allows normal punctuation but rejects oversized and control-character input', () => {
  assert.deepEqual(validateSearch(' Acme & Sons '), { value: 'Acme & Sons', error: undefined });
  assert.ok(validateSearch('x'.repeat(inputLimits.search + 1)).error);
  assert.ok(validateSearch('Acme\u0000').error);
});
