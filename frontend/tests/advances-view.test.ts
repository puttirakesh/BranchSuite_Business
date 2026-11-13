import assert from 'node:assert/strict';
import { test } from 'node:test';
import { advanceRequestsSubtitle, filterAdvancesByStatus, formatAdvanceStatus } from '../src/core/admin/advances-view';

test('subtitle handles zero, one and many', () => {
  assert.equal(advanceRequestsSubtitle('Main', 0), 'Main · 0 requests');
  assert.equal(advanceRequestsSubtitle('Main', 1), 'Main · 1 request');
  assert.equal(advanceRequestsSubtitle('Main', 7), 'Main · 7 requests');
});

test('subtitle falls back to All branches and never contains template syntax', () => {
  for (const name of [undefined, null, '', '  ']) {
    const text = advanceRequestsSubtitle(name, 3);
    assert.equal(text, 'All branches · 3 requests');
    assert.ok(!text.includes('`') && !text.includes('${'));
  }
});

test('filterAdvancesByStatus filters each status', () => {
  const rows = [
    { id: 1, status: 'PENDING' }, { id: 2, status: 'APPROVED' }, { id: 3, status: 'REJECTED' },
    { id: 4, status: 'CANCELLED' }, { id: 5, status: 'PENDING' },
  ];
  assert.equal(filterAdvancesByStatus(rows, 'ALL').length, 5);
  assert.deepEqual(filterAdvancesByStatus(rows, 'PENDING').map(r => r.id), [1, 5]);
  assert.deepEqual(filterAdvancesByStatus(rows, 'APPROVED').map(r => r.id), [2]);
  assert.deepEqual(filterAdvancesByStatus(rows, 'REJECTED').map(r => r.id), [3]);
  assert.deepEqual(filterAdvancesByStatus(rows, 'CANCELLED').map(r => r.id), [4]);
});

test('formatAdvanceStatus title-cases enums', () => {
  assert.equal(formatAdvanceStatus('PENDING'), 'Pending');
  assert.equal(formatAdvanceStatus('CANCELLED'), 'Cancelled');
});
