import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calendarDateKey, parseCalendarDate, formatCalendarDate, isAllowedCalendarDate, calendarRangeError, addDays } from '../src/core/domain/dates';
import { subscriptionSchema } from '../src/features/customers/schemas/subscription.schema';
import { offerSchema, campaignSchema } from '../src/features/offers/schemas/offer.schema';
import { pageOf } from '../src/core/api/types';

test('calendar round-trips leap days and local date components without UTC drift', () => {
  for (const key of ['2024-02-29', '2026-11-04', '0099-01-01', '9999-12-31']) {
    assert.equal(calendarDateKey(parseCalendarDate(key)!), key);
  }
  assert.equal(parseCalendarDate('2026-02-29'), null);
  assert.equal(parseCalendarDate('2026-04-31'), null);
  assert.equal(formatCalendarDate('2026-11-04'), '04 Nov 2026');
  assert.equal(addDays('2024-02-28', 1), '2024-02-29');
});

test('calendar bounds are inclusive and invalid or reversed bounds reject selection', () => {
  assert.equal(isAllowedCalendarDate('2026-11-04', '2026-11-04', '2026-11-04'), true);
  assert.equal(isAllowedCalendarDate('2026-11-03', '2026-11-04'), false);
  assert.equal(isAllowedCalendarDate('2026-11-05', undefined, '2026-11-04'), false);
  assert.ok(calendarRangeError('2026-11-05', '2026-11-04'));
  assert.ok(calendarRangeError('invalid'));
  assert.equal(isAllowedCalendarDate('', undefined, undefined), false);
});

test('subscription, offer and campaign forms reject impossible ranges', () => {
  assert.equal(subscriptionSchema.safeParse({ planId: 'pro', cycle: 'Monthly', status: 'Active', renewOn: '2026-11-01', trialEndsOn: '2026-11-02' }).success, false);
  assert.equal(offerSchema(0, '2026-11-01').safeParse({ code: 'SAVE', percent: 10, maxUses: 100, startsOn: '2026-12-01', expiresOn: '2026-11-30', enabled: true }).success, false);
  const campaign = { name: 'Winter', channel: 'Website', status: 'Draft', offerCode: '', notes: '' };
  assert.equal(campaignSchema.safeParse({ ...campaign, startsOn: '', endsOn: '' }).success, true);
  assert.equal(campaignSchema.safeParse({ ...campaign, startsOn: '2026-12-01', endsOn: '2026-11-30' }).success, false);
});

test('pagination retains all records across page boundaries and empty results', () => {
  const items = Array.from({ length: 45 }, (_, id) => id);
  assert.deepEqual([1, 2, 3].flatMap(page => pageOf(items, { page, limit: 20 }).items), items);
  assert.equal(pageOf([], { page: 1, limit: 20 }).total, 0);
});
