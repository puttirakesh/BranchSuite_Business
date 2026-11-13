import assert from 'node:assert/strict';
import { test } from 'node:test';
import { filterApprovals, pendingCounts, scopeByBranch, type ApprovalFilterable } from '../src/core/admin/approvals-filter';

const rows: (ApprovalFilterable & { id: number })[] = [
  { id: 1, type: 'leave', status: 'pending', branch: 'North', employeeName: 'Asha', leaveType: 'Casual', reason: 'Wedding' },
  { id: 2, type: 'leave', status: 'approved', branch: 'South', employeeName: 'Ravi', leaveType: 'Sick', reason: 'Fever' },
  { id: 3, type: 'correction', status: 'pending', branch: 'North', employeeName: 'Meena', reason: 'Forgot checkout' },
  { id: 4, type: 'correction', status: 'rejected', branch: 'South', employeeName: 'Asha', reason: 'Late' },
  { id: 5, type: 'leave', status: 'cancelled', branch: 'North', employeeName: 'Kiran', leaveType: 'Casual', reason: 'Plans changed' },
  { id: 6, type: 'leave', status: 'pending', employeeName: undefined, reason: 'x' },
];
const ids = (list: { id: number }[]) => list.map(r => r.id);

test('no filters returns everything', () => {
  assert.deepEqual(ids(filterApprovals(rows, {})), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(ids(filterApprovals(rows, { status: 'ALL', type: '', branch: '', search: '  ' })), [1, 2, 3, 4, 5, 6]);
});

test('each status filter matches backend enum values', () => {
  assert.deepEqual(ids(filterApprovals(rows, { status: 'PENDING' })), [1, 3, 6]);
  assert.deepEqual(ids(filterApprovals(rows, { status: 'APPROVED' })), [2]);
  assert.deepEqual(ids(filterApprovals(rows, { status: 'REJECTED' })), [4]);
  assert.deepEqual(ids(filterApprovals(rows, { status: 'CANCELLED' })), [5]);
});

test('type and branch filters', () => {
  assert.deepEqual(ids(filterApprovals(rows, { type: 'correction' })), [3, 4]);
  assert.deepEqual(ids(filterApprovals(rows, { branch: 'South' })), [2, 4]);
  assert.deepEqual(ids(filterApprovals(rows, { branch: 'Unknown branch' })), [6]);
});

test('search matches name, type label, branch and reason, case-insensitively', () => {
  assert.deepEqual(ids(filterApprovals(rows, { search: 'asha' })), [1, 4]);
  assert.deepEqual(ids(filterApprovals(rows, { search: 'attendance corr' })), [3, 4]);
  assert.deepEqual(ids(filterApprovals(rows, { search: 'SOUTH' })), [2, 4]);
  assert.deepEqual(ids(filterApprovals(rows, { search: 'fever' })), [2]);
  assert.deepEqual(ids(filterApprovals(rows, { search: 'team member' })), [6]);
});

test('combined search + status + type + branch', () => {
  assert.deepEqual(ids(filterApprovals(rows, { search: 'asha', status: 'PENDING', type: 'leave', branch: 'North' })), [1]);
  assert.deepEqual(ids(filterApprovals(rows, { search: 'asha', status: 'REJECTED', type: 'leave' })), []);
  assert.deepEqual(ids(filterApprovals(rows, { status: 'CANCELLED', branch: 'South' })), []);
});

test('banner counts are pending items in branch scope, independent of other filters', () => {
  assert.deepEqual(pendingCounts(scopeByBranch(rows, '')), { leave: 2, correction: 1 });
  assert.deepEqual(pendingCounts(scopeByBranch(rows, 'North')), { leave: 1, correction: 1 });
  assert.deepEqual(pendingCounts(scopeByBranch(rows, 'South')), { leave: 0, correction: 0 });
});
