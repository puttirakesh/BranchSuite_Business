import { test } from 'node:test';
import assert from 'node:assert/strict';
import { effectiveStatus, limitViolations, monthlyValue, needsAttention } from '../src/core/domain/subscription';
import { addDays, isValidIsoDate } from '../src/core/domain/dates';
import { statusTone } from '../src/core/domain/status';

const base = { status: 'Active' as const, renewOn: '2026-10-15', trialEndsOn: '2026-09-29', graceEndsOn: '2026-10-22', cancelAtRenewal: false };

test('active subscription stays active before renewal', () => {
  assert.equal(effectiveStatus(base, '2026-10-03'), 'Active');
});
test('active subscription becomes past due during grace period', () => {
  assert.equal(effectiveStatus(base, '2026-10-18'), 'Past due');
});
test('active subscription expires after grace period', () => {
  assert.equal(effectiveStatus(base, '2026-10-23'), 'Expired');
});
test('scheduled cancellation takes effect at renewal', () => {
  assert.equal(effectiveStatus({ ...base, cancelAtRenewal: true }, '2026-10-16'), 'Cancelled');
});
test('trial expires after its end date', () => {
  assert.equal(effectiveStatus({ ...base, status: 'Trial', trialEndsOn: '2026-10-08' }, '2026-10-09'), 'Expired');
  assert.equal(effectiveStatus({ ...base, status: 'Trial', trialEndsOn: '2026-10-08' }, '2026-10-08'), 'Trial');
});
test('needsAttention matches APK attention states', () => {
  assert.deepEqual(['Active', 'Trial', 'Past due', 'Expired', 'Suspended', 'Cancelled'].filter((s) => needsAttention(s as never)), ['Past due', 'Expired', 'Suspended']);
});
test('plan limits below usage are reported', () => {
  const usage = { employees: 128, branches: 3, companies: 1, users: 6 };
  assert.deepEqual(limitViolations(usage, { employees: 75, branches: 2, companies: 1, users: 5 }), ['128 employees / 75 allowed', '3 branches / 2 allowed', '6 users / 5 allowed']);
  assert.deepEqual(limitViolations(usage, { employees: 250, branches: 10, companies: 3, users: 15 }), []);
});
test('annual plans count as one twelfth per month', () => {
  assert.equal(monthlyValue('Annual', 2499, 24990), 2082.5);
  assert.equal(monthlyValue('Monthly', 2499, 24990), 2499);
});
test('date helpers', () => {
  assert.equal(addDays('2026-10-01', 7), '2026-10-08');
  assert.equal(isValidIsoDate('2026-02-30'), false);
  assert.equal(isValidIsoDate('2026-02-28'), true);
  assert.equal(isValidIsoDate('28-02-2026'), false);
});
test('badge tones follow APK rules', () => {
  assert.equal(statusTone('Paid'), 'green');
  assert.equal(statusTone('Past due'), 'amber');
  assert.equal(statusTone('Suspended'), 'red');
  assert.equal(statusTone('In progress'), 'purple');
});
