import assert from 'node:assert/strict';
import { test } from 'node:test';
import { acceptsInput, isEmail, validateInput } from '../src/shared/validation/input';
import { InputValidationError, validateManualRequest } from '../src/shared/validation/request';
import { api } from '../src/core/api/client';

test('phone input and submission require digits while optional blank phones remain valid', () => {
  const rule = { kind: 'phone' as const };
  for (const value of ['123abc', '123 4567890', '+919876543210', '१२३४५६७८९०', '12345678901']) assert.equal(acceptsInput(value, rule), false, value);
  assert.equal(acceptsInput('9876543210', rule), true);
  assert.equal(acceptsInput('', rule), true);
  assert.equal(validateInput('', rule), undefined);
  assert.ok(validateInput('123', rule));
  assert.ok(validateInput('', { ...rule, required: true }));
  assert.equal(validateInput('9876543210', rule), undefined);
});

test('email validates the entire address and allows common mailbox punctuation', () => {
  for (const value of ['name@example.com', 'first.last+tag@sub.example.co.in', "o'connor@example.com"]) assert.equal(isEmail(value), true, value);
  for (const value of ['name', 'a@@example.com', 'a..b@example.com', '.a@example.com', 'a.@example.com', 'a@-example.com', 'a@example-.com', 'a@exam_ple.com', 'a@example..com', 'a b@example.com', 'a@example.com\n', `${'a'.repeat(65)}@example.com`]) assert.equal(isEmail(value), false, value);
});

test('numeric input rejects malformed pasted values and validates ranges at completion', () => {
  const amount = { kind: 'decimal' as const, min: 0.01 };
  for (const value of ['1e3', '-2', '1,000', '1.2.3', '2.999', 'Infinity', 'NaN']) assert.equal(acceptsInput(value, amount), false, value);
  for (const value of ['', '0.', '0.50', '2500', '123456789012.99']) assert.equal(acceptsInput(value, amount), true, value);
  assert.ok(validateInput('0.', amount));
  assert.ok(validateInput('0', amount));
  assert.equal(validateInput('0.01', amount), undefined);
  assert.ok(validateInput('367', { kind: 'integer', min: 0, max: 366 }));
  assert.ok(validateInput('1.5', { kind: 'integer' }));
  assert.equal(validateInput('0042', { kind: 'integer', minLength: 4, maxLength: 4 }), undefined);
});

test('text respects whitespace, lengths, Unicode, and password preservation', () => {
  assert.ok(validateInput('  ', { required: true }));
  assert.equal(validateInput('మణి O’Connor', { required: true, maxLength: 150 }), undefined);
  assert.equal(acceptsInput('Line one\nLine two', {}, true), true);
  assert.equal(acceptsInput('Line one\nLine two', {}, false), false);
  assert.equal(acceptsInput('bad\u0000text', {}, true), false);
  const password = '  secret value  ';
  assert.equal(acceptsInput(password, { kind: 'password' }), true);
  assert.equal(validateInput(password, { kind: 'password', matches: password, minLength: 8 }), undefined);
  assert.ok(validateInput(password, { kind: 'password', matches: password.trim() }));
});

test('submission validation covers contact, payroll, leave, support and quote constraints', () => {
  const bad: [string, string, unknown][] = [
    ['/users', 'post', { name: 'Person', email: 'a@@example.com', password: 'valid-password' }],
    ['/customers/id', 'patch', { phone: '123abc' }],
    ['/tasks', 'post', { title: '  ' }],
    ['/advances', 'post', { amount: '0', reason: 'Travel' }],
    ['/payroll/employee-salaries/revise', 'post', { gross: '100', deductions: '101', reason: 'Revision' }],
    ['/leave/balances/allocate', 'post', { year: 2101, allocatedDays: 10 }],
    ['/leave/types', 'post', { code: 'CL', name: 'Casual', annualAllowance: 366.5 }],
    ['/support/tickets', 'post', { subject: 'abc', message: 'A detailed message' }],
    ['/quotes', 'post', { title: 'Quote', items: [{ description: 'Item', quantity: 1.5, unitPrice: '10' }] }],
    ['/billing/invoices', 'post', { description: 'Invoice', amount: '1e3' }],
    ['/auth/reset-password', 'post', { token: 'a'.repeat(64), newPassword: 'password1', confirmPassword: 'password2' }],
  ];
  for (const args of bad) assert.throws(() => validateManualRequest(...args), InputValidationError, args[0]);
  assert.doesNotThrow(() => validateManualRequest('/customers/id', 'patch', { email: null, phone: null, notes: '' }));
  assert.doesNotThrow(() => validateManualRequest('/auth/login', 'post', { email: 'a@example.com', password: 'old' }));
  assert.doesNotThrow(() => validateManualRequest('/quotes', 'post', { title: 'Quote', items: [{ description: 'Item', quantity: 1, unitPrice: '0.50' }] }));
  assert.doesNotThrow(() => validateManualRequest('/support/tickets/id/messages', 'post', { message: 'A reply' }));
});

test('invalid untouched values are stopped before the HTTP adapter is invoked', async () => {
  const previous = api.defaults.adapter;
  let sent = false;
  api.defaults.adapter = async config => { sent = true; return { data: {}, status: 200, statusText: 'OK', headers: {}, config }; };
  try {
    await assert.rejects(api.post('/users', { name: 'Person', email: 'invalid', password: 'password1' }), InputValidationError);
    assert.equal(sent, false);
    await api.post('/users', { name: 'Person', email: 'person@example.com', phone: '9876543210', password: 'password1' });
    assert.equal(sent, true);
  } finally { api.defaults.adapter = previous; }
});
