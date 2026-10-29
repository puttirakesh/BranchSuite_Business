import assert from 'node:assert/strict';
import { test } from 'node:test';
import { attendanceCorrectionTimes } from '../src/features/employee/attendanceCorrectionTimes';

test('early morning correction retains the selected IST date', () => {
  const result = attendanceCorrectionTimes('2026-10-29', '2:00 AM', '10:00 AM', Date.parse('2026-10-30T00:00:00Z'));
  assert.equal(result.requestedCheckInAt, '2026-10-28T20:30:00.000Z');
  assert.equal(result.requestedCheckOutAt, '2026-10-29T04:30:00.000Z');
});
test('overnight shifts end the next local date and future/invalid requests are rejected', () => {
  const result = attendanceCorrectionTimes('2026-10-28', '10:00 PM', '6:00 AM', Date.parse('2026-10-30T00:00:00Z'));
  assert.equal(result.requestedCheckInAt, '2026-10-28T16:30:00.000Z');
  assert.equal(result.requestedCheckOutAt, '2026-10-29T00:30:00.000Z');
  assert.throws(() => attendanceCorrectionTimes('2026-02-30', '9:00 AM', '6:00 PM'), /valid attendance date/);
  assert.throws(() => attendanceCorrectionTimes('2026-10-29', '9:00 AM', '6:00 PM', Date.parse('2026-10-29T04:00:00Z')), /future/);
});
