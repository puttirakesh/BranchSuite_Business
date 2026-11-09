import { test } from 'node:test';
import assert from 'node:assert/strict';
import { can } from '../src/core/permissions/roles';
import { NAV_ITEMS } from '../src/core/config/navigation';
import { canComposeInternalNote, canRunQuery } from '../src/core/permissions/queryAccess';
import { refreshDashboard } from '../src/features/dashboard/dashboard-refresh';

test('platform admin can use every module', () => {
  for (const c of ['plans.manage', 'billing.view', 'marketing.manage', 'offers.manage', 'settings.manage', 'audit.view', 'customers.manageLicence'] as const)
    assert.equal(can('PLATFORM_ADMIN', c), true, c);
});
test('platform support is limited to overview and support, with ticket lifecycle control', () => {
  for (const c of ['dashboard.view', 'support.view', 'support.reply', 'support.internalNote', 'support.changeStatus'] as const) assert.equal(can('PLATFORM_SUPPORT', c), true, c);
  for (const c of ['customers.view', 'plans.manage', 'billing.view', 'marketing.manage', 'offers.manage', 'settings.manage', 'audit.view', 'customers.manageLicence'] as const)
    assert.equal(can('PLATFORM_SUPPORT', c), false, c);
});
test('platform support navigation excludes admin-only modules', () => {
  const labels = NAV_ITEMS.filter((item) => can('PLATFORM_SUPPORT', item.capability)).map((item) => item.label);
  assert.deepEqual(labels, ['Overview', 'Support businesses', 'Support']);
});
test('real API queries for forbidden support areas remain disabled', () => {
  for (const capability of ['offers.manage', 'customers.view', 'billing.view', 'settings.manage', 'audit.view'] as const)
    assert.equal(canRunQuery('api', 'PLATFORM_SUPPORT', capability), false, capability);
  assert.equal(canRunQuery('api', 'PLATFORM_ADMIN', 'offers.manage', false), false, 'hidden editor');
});
test('internal notes are available to both platform roles in preview and real API mode', () => {
  for (const mode of ['preview', 'api'] as const)
    for (const role of ['PLATFORM_SUPPORT', 'PLATFORM_ADMIN'] as const) assert.equal(canComposeInternalNote(mode, role), true, mode + ' ' + role);
  assert.equal(canComposeInternalNote('api', null), false);
});
test('support dashboard refresh requests metrics but never customers', async () => {
  let metrics = 0;
  let customers = 0;
  await refreshDashboard('PLATFORM_SUPPORT', {
    metrics: async () => { metrics += 1; },
    customers: async () => { customers += 1; },
  });
  assert.equal(metrics, 1);
  assert.equal(customers, 0);
});
test('admin dashboard refresh preserves metrics and customer refresh', async () => {
  let metrics = 0;
  let customers = 0;
  await refreshDashboard('PLATFORM_ADMIN', {
    metrics: async () => { metrics += 1; },
    customers: async () => { customers += 1; },
  });
  assert.equal(metrics, 1);
  assert.equal(customers, 1);
});
test('no role means no access', () => {
  assert.equal(can(null, 'dashboard.view'), false);
});

test('support ticket mapping uses server-provided names, roles, visibility and context', async () => {
  const { mapTicket } = await import('../src/features/support/api/support.api');
  const ticket = mapTicket({
    id: 't1', tenantId: 'x', customerName: 'Acme Ltd', company: { id: 'c', name: 'Acme HQ' }, branch: { id: 'b', name: 'North' },
    requester: { id: 'u', name: 'Riya' }, awaitingSupport: true, subject: 'Payslip', category: 'PAYROLL', status: 'IN_PROGRESS', priority: 'HIGH',
    createdAt: '2026-11-04T10:00:00.000Z',
    messages: [
      { id: 'm1', authorName: 'Riya', authorRole: 'REQUESTER', visibility: 'CUSTOMER', message: 'Help', createdAt: '2026-11-04T10:00:00.000Z' },
      { id: 'm2', authorName: 'Sam Support', authorRole: 'PLATFORM_SUPPORT', visibility: 'INTERNAL', message: 'Check ledger', createdAt: '2026-11-04T10:05:00.000Z' },
    ],
    history: [{ id: 'h1', summary: 'Ticket created', actorName: 'Riya', actorRole: 'REQUESTER', visibility: 'CUSTOMER', createdAt: '2026-11-04T10:00:00.000Z' }],
  });
  assert.equal(ticket.customerName, 'Acme Ltd');
  assert.equal(ticket.status, 'In progress');
  assert.deepEqual([ticket.company, ticket.branch, ticket.requester], ['Acme HQ', 'North', 'Riya']);
  assert.deepEqual(ticket.messages.map((m) => [m.by, m.authorRole, m.internal]), [['Riya', 'REQUESTER', false], ['Sam Support', 'PLATFORM_SUPPORT', true]]);
  assert.equal(ticket.history?.length, 1);
});
