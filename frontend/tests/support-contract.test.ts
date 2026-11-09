import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { canMoveSupportTicket, supportAuthorLabel, type SupportAuthorRole } from '../src/core/admin/workspace-records.api';

const message = (authorRole: SupportAuthorRole, authorId: string | null, authorName: string) => ({ authorId, authorName, authorRole });

test('support author labels come from the server role, not id heuristics', () => {
  assert.equal(supportAuthorLabel(message('REQUESTER', 'u1', 'Riya'), 'u1'), 'You');
  assert.equal(supportAuthorLabel(message('REQUESTER', 'u1', 'Riya'), 'admin'), 'Riya');
  assert.equal(supportAuthorLabel(message('COMPANY_ADMIN', 'a1', 'Cora'), 'u1'), 'Cora (company admin)');
  assert.equal(supportAuthorLabel(message('COMPANY_ADMIN', 'a1', 'Cora'), 'a1'), 'You (company admin)');
  // A company admin replying to an employee ticket must never be shown as platform Support.
  assert.notEqual(supportAuthorLabel(message('COMPANY_ADMIN', 'a1', 'Cora'), 'u1'), 'BranchSuite Support');
  for (const role of ['PLATFORM_SUPPORT', 'PLATFORM_ADMIN'] as const) assert.equal(supportAuthorLabel(message(role, null, 'BranchSuite Support'), 'u1'), 'BranchSuite Support');
});

test('lifecycle helper matches the backend transition matrix', () => {
  assert.equal(canMoveSupportTicket('OPEN', 'IN_PROGRESS'), true);
  assert.equal(canMoveSupportTicket('RESOLVED', 'OPEN'), true);
  assert.equal(canMoveSupportTicket('CLOSED', 'OPEN'), true);
  assert.equal(canMoveSupportTicket('CLOSED', 'RESOLVED'), false);
  assert.equal(canMoveSupportTicket('CLOSED', 'IN_PROGRESS'), false);
  assert.equal(canMoveSupportTicket('OPEN', 'OPEN'), true);
});

test('Business support types never declare an internal visibility and UI never selects internal fields', () => {
  const api = readFileSync(new URL('../src/core/admin/workspace-records.api.ts', import.meta.url), 'utf8');
  assert.ok(api.includes("visibility: 'CUSTOMER'"));
  assert.ok(!/INTERNAL/.test(api), 'Business API types must not model internal notes');
  for (const page of ['../app/employee/help/index.tsx', '../app/admin/platform-support/index.tsx'])
    assert.ok(!/INTERNAL|internal note/i.test(readFileSync(new URL(page, import.meta.url), 'utf8')), page);
});
