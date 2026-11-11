// Pure date-rule tests for prepaid plan validity (UTC calendar-month policy).
require('reflect-metadata');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  addCalendarMonths, computeValidity, cycleMonths, daysRemaining, effectiveExpiry,
} = require('../src/common/subscription-dates');

const utc = (y, m, d, h = 10, mi = 0, s = 0) => new Date(Date.UTC(y, m - 1, d, h, mi, s));
const iso = (date) => date.toISOString();

test('monthly = one calendar month, annual = twelve, same time of day', () => {
  assert.equal(cycleMonths('monthly'), 1);
  assert.equal(cycleMonths('annual'), 12);
  assert.equal(iso(addCalendarMonths(utc(2026, 11, 11, 10, 30, 15), 1)), '2026-12-11T10:30:15.000Z');
  assert.equal(iso(addCalendarMonths(utc(2026, 11, 11, 10, 30, 15), 12)), '2027-11-11T10:30:15.000Z');
});

test('month-end dates clamp to the last day of the shorter month', () => {
  assert.equal(iso(addCalendarMonths(utc(2026, 1, 31), 1)), '2026-02-28T10:00:00.000Z'); // non-leap
  assert.equal(iso(addCalendarMonths(utc(2028, 1, 31), 1)), '2028-02-29T10:00:00.000Z'); // leap
  assert.equal(iso(addCalendarMonths(utc(2026, 3, 31), 1)), '2026-04-30T10:00:00.000Z');
  assert.equal(iso(addCalendarMonths(utc(2026, 8, 31), 1)), '2026-09-30T10:00:00.000Z');
  assert.equal(iso(addCalendarMonths(utc(2026, 12, 31), 1)), '2027-01-31T10:00:00.000Z'); // year rollover
});

test('leap-day annual purchases land on 28 Feb of the next (non-leap) year; 28 Feb stays', () => {
  assert.equal(iso(addCalendarMonths(utc(2028, 2, 29), 12)), '2029-02-28T10:00:00.000Z');
  assert.equal(iso(addCalendarMonths(utc(2027, 2, 28), 12)), '2028-02-28T10:00:00.000Z');
  assert.equal(iso(addCalendarMonths(utc(2024, 2, 29), 48)), '2028-02-29T10:00:00.000Z');
});

test('a first payment starts at the payment time', () => {
  const now = utc(2026, 11, 11, 9);
  const v = computeValidity({ now, cycle: 'monthly', currentStatus: 'PENDING_ACTIVATION', currentExpiry: null });
  assert.equal(iso(v.validFrom), iso(now));
  assert.equal(iso(v.validUntil), '2026-12-11T09:00:00.000Z');
});

test('early renewal extends from the existing expiry, not from the payment date', () => {
  const now = utc(2026, 12, 1, 8);
  const v = computeValidity({ now, cycle: 'monthly', currentStatus: 'ACTIVE', currentExpiry: utc(2026, 12, 11, 9) });
  assert.equal(iso(v.validFrom), '2026-12-11T09:00:00.000Z');
  assert.equal(iso(v.validUntil), '2027-01-11T09:00:00.000Z');
  const annual = computeValidity({ now, cycle: 'annual', currentStatus: 'ACTIVE', currentExpiry: utc(2026, 12, 11, 9) });
  assert.equal(iso(annual.validUntil), '2027-12-11T09:00:00.000Z');
});

test('renewing an expired plan starts from the verified payment time', () => {
  const now = utc(2026, 12, 20, 12);
  for (const currentStatus of ['ACTIVE', 'EXPIRED', 'CANCELLED', 'PAST_DUE']) {
    const v = computeValidity({ now, cycle: 'monthly', currentStatus, currentExpiry: utc(2026, 12, 11, 9) });
    assert.equal(iso(v.validFrom), iso(now), currentStatus);
    assert.equal(iso(v.validUntil), '2027-01-20T12:00:00.000Z');
  }
  // Status other than ACTIVE never extends from an old expiry even if it is in the future.
  const odd = computeValidity({ now, cycle: 'monthly', currentStatus: 'CANCELLED', currentExpiry: utc(2027, 1, 1) });
  assert.equal(iso(odd.validFrom), iso(now));
});

test('effective expiry is the earliest recorded end; days remaining round up and never go negative', () => {
  assert.equal(effectiveExpiry({ expiresAt: null, currentPeriodEnd: null }), null);
  assert.equal(iso(effectiveExpiry({ expiresAt: utc(2026, 12, 1), currentPeriodEnd: utc(2026, 12, 5) })), '2026-12-01T10:00:00.000Z');
  assert.equal(daysRemaining(utc(2026, 11, 12, 11), utc(2026, 11, 11, 10)), 2); // 25 h -> 2 days
  assert.equal(daysRemaining(utc(2026, 11, 11, 10), utc(2026, 11, 11, 10)), 0);
  assert.equal(daysRemaining(utc(2026, 11, 1), utc(2026, 11, 11)), 0);
  assert.equal(daysRemaining(null), 0);
});
