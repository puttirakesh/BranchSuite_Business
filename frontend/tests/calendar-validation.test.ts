import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calendarDateKey, calendarRangeError, isAllowedCalendarDate, parseCalendarDate } from '../src/shared/validation/date';

test('calendar dates reject impossible days rather than rolling into another month', () => {
  for (const value of ['2026-02-29', '2026-04-31', '2026-13-01', '2026-00-01', '2026-01-00', '2026-1-1', '2026-10-20T00:00:00Z', '0000-01-01']) assert.equal(parseCalendarDate(value), null, value);
  for (const value of ['2024-02-29', '2026-10-20', '0099-01-01', '0001-01-01', '9999-12-31']) assert.equal(calendarDateKey(parseCalendarDate(value)!), value);
});

test('calendar date limits are inclusive and malformed or reversed limits fail closed', () => {
  assert.equal(isAllowedCalendarDate('2026-10-20', '2026-10-20', '2026-10-31'), true);
  assert.equal(isAllowedCalendarDate('2026-10-31', '2026-10-20', '2026-10-31'), true);
  assert.equal(isAllowedCalendarDate('2026-10-19', '2026-10-20', '2026-10-31'), false);
  assert.equal(isAllowedCalendarDate('2026-11-01', '2026-10-20', '2026-10-31'), false);
  assert.ok(calendarRangeError('2026-10-31', '2026-10-20'));
  assert.ok(calendarRangeError('not-a-date'));
  assert.equal(isAllowedCalendarDate('2026-10-20', 'not-a-date'), false);
});
