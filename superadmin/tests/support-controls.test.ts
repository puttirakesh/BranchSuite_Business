import assert from 'node:assert/strict';
import { test } from 'node:test';
import { allowedTicketStatuses, canSubmitTicketMessage } from '../src/features/support/ticket-controls';
import { TICKET_STATUSES } from '../src/features/support/types';

test('closed ticket only offers its current state and reopening; other states preserve valid transitions', () => {
  assert.deepEqual(allowedTicketStatuses('Closed'), ['Closed', 'Open']);
  for (const status of ['Open', 'In progress', 'Resolved'] as const) assert.deepEqual(allowedTicketStatuses(status), [...TICKET_STATUSES]);
});

test('closed public replies stay blocked while authorized private notes remain available', () => {
  assert.equal(canSubmitTicketMessage('Closed', false, true), false);
  assert.equal(canSubmitTicketMessage('Closed', true, true), true);
  assert.equal(canSubmitTicketMessage('Closed', true, false), false);
  assert.equal(canSubmitTicketMessage('Resolved', false, false), true);
});
