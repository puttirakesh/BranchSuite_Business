import assert from 'node:assert/strict';
import { test } from 'node:test';
import { supportTicketInput, notificationDestination } from '../src/core/admin/support-workflow';
import { canOpenAdminPath } from '../src/core/admin/access';
import type { AuthSession } from '../src/core/api/client';
import { api } from '../src/core/api/client';
import { supportTicketsApi } from '../src/core/admin/workspace-records.api';

test('ticket input validates boundaries and never invents a branch for a company-wide issue', () => {
  const input = supportTicketInput('company', '', 'ACCOUNT', '  Account issue  ', '  Cannot access my account.  ', []);
  assert.deepEqual(input, { companyId: 'company', category: 'ACCOUNT', subject: 'Account issue', message: 'Cannot access my account.' });
  assert.equal(supportTicketInput('company', 'north', 'OTHER', 'Help', 'Need some help', ['north']).branchId, 'north');
  for (const args of [
    ['', '', 'OTHER', 'Help', 'Need some help', []],
    ['company', 'other', 'OTHER', 'Help', 'Need some help', ['north']],
    ['company', '', 'INVALID', 'Help', 'Need some help', []],
    ['company', '', 'OTHER', 'abc', 'Need some help', []],
    ['company', '', 'OTHER', 'Help', 'too short', []],
    ['company', '', 'OTHER', 'x'.repeat(181), 'Need some help', []],
    ['company', '', 'OTHER', 'Help', 'x'.repeat(10001), []],
  ] as [string, string, string, string, string, string[]][]) assert.throws(() => supportTicketInput(...args));
});

test('notification targets preserve the ticket query for both workspaces and old notifications', () => {
  assert.equal(notificationDestination('/employee/help?ticketId=t1', true), '/admin/platform-support?ticketId=t1');
  assert.equal(notificationDestination('/employee/help?ticketId=t1', false), '/employee/help?ticketId=t1');
  assert.equal(notificationDestination('/employee/help', true), '/admin/platform-support');
  assert.equal(notificationDestination('/employee/helpful', true), '/employee/helpful');
});

test('managers can reach personal Support without receiving company administration routes', () => {
  const auth = (role: string): AuthSession => ({ user: { id: 'u', name: 'User', email: 'u@example.invalid' }, memberships: [{ id: 'm', tenantId: 't', companyId: 'c', companyName: 'Company', role, permissions: [], branches: [{ id: 'b', name: 'North' }] }] });
  for (const role of ['BUSINESS_OWNER', 'BUSINESS_ADMIN', 'COMPANY_MANAGER', 'BRANCH_MANAGER', 'HR_MANAGER', 'PAYROLL_MANAGER', 'SALES_MANAGER']) assert.ok(canOpenAdminPath(auth(role), 'c', '/admin/platform-support'));
  for (const role of ['COMPANY_MANAGER', 'HR_MANAGER', 'PAYROLL_MANAGER']) assert.equal(canOpenAdminPath(auth(role), 'c', '/admin/billing'), false);
  assert.equal(canOpenAdminPath(auth('EMPLOYEE'), 'c', '/admin/platform-support'), false);
  assert.equal(canOpenAdminPath(auth('HR_MANAGER'), 'other', '/admin/platform-support'), false);
});

test('a notification reply uses the ticket company rather than a stale selected-company header', async t => {
  const adapter = api.defaults.adapter;
  const previousCompany = api.defaults.headers.common['X-Company-Id'];
  t.after(() => { api.defaults.adapter = adapter; api.defaults.headers.common['X-Company-Id'] = previousCompany; });
  api.defaults.headers.common['X-Company-Id'] = 'previous-company';
  const requests: { company: unknown; ticketId?: string }[] = [];
  api.defaults.adapter = async config => {
    requests.push({ company: config.headers.get('X-Company-Id'), ticketId: config.params?.ticketId });
    return { config, status: 200, statusText: 'OK', headers: {}, data: [] };
  };
  await supportTicketsApi.reply('ticket', 'Additional requester details.', 'ticket-company');
  await supportTicketsApi.mine('ticket');
  assert.equal(requests[0].company, 'ticket-company');
  assert.equal(requests[1].ticketId, 'ticket');
  assert.equal(api.defaults.headers.common['X-Company-Id'], 'previous-company', 'request override must not change workspace selection');
});
