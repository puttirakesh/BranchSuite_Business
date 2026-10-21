import assert from 'node:assert/strict';
import { test } from 'node:test';
import { activeDestination, adminDestinations, employeeDestinations, filterDestinations, getAdminDestinations, webWorkspaceLayout } from '../src/ui/workspace-navigation';
import type { AuthSession } from '../src/core/api/client';

const session = (role: string): AuthSession => ({ user: { id: 'user', name: 'Test', email: 'test@example.invalid' }, memberships: [{ id: 'member', companyId: 'company', companyName: 'Company', tenantId: 'tenant', role, permissions: [], branches: [{ id: 'branch', name: 'Branch' }] }] });

test('web navigation reserves sidebar space only when it is visible', () => {
  for (const width of [320, 390, 767, 768, 900, 1024, 1199, 1200, 1440, 1920]) {
    const layout = webWorkspaceLayout(width);
    assert.equal(layout.webNavigation, width >= 768);
    assert.equal(layout.persistentSidebar, width >= 1200);
    assert.equal(layout.sidebarWidth, width >= 1200 ? 248 : 0);
    assert.ok(width - layout.sidebarWidth >= 320);
  }
});

test('navigation highlights the specific module on nested and overlapping routes', () => {
  for (const [path, label] of [
    ['/admin/dashboard', 'Dashboard'], ['/admin/crm/lead-form', 'Leads'], ['/admin/crm/lead/123', 'Leads'],
    ['/admin/crm/deals/123', 'Opportunities'], ['/admin/crm/quotes/123', 'Quotations'],
    ['/admin/crm/customers/123', 'Customers'],
    ['/admin/tasks/follow-ups', 'Tasks'], ['/admin/attendance/team', 'Team attendance'], ['/admin/attendance', 'My attendance'],
    ['/admin/profile/documents', 'My profile'],
  ]) assert.equal(activeDestination(adminDestinations, path)?.label, label);
  assert.equal(activeDestination(adminDestinations, '/admin/crm-not-a-route'), undefined);
  assert.equal(activeDestination(employeeDestinations, '/employee/tasks/123')?.label, 'My tasks');
  assert.equal(activeDestination(employeeDestinations, '/employee/documents')?.label, 'My documents');
});

test('sidebar and module search respect company roles and use keywords', () => {
  assert.equal(getAdminDestinations(session('EMPLOYEE'), 'company').length, 0);
  assert.equal(getAdminDestinations(session('BUSINESS_OWNER'), 'other-company').length, 0);
  for (const role of ['HR_MANAGER', 'BRANCH_MANAGER', 'PAYROLL_MANAGER']) {
    const items = getAdminDestinations(session(role), 'company');
    assert.ok(!items.some(item => item.href === '/admin/tasks/follow-ups'));
    assert.ok(!items.some(item => item.href === '/admin/roles-permissions'));
    assert.equal(items.some(item => item.href === '/admin/payroll'), role === 'PAYROLL_MANAGER');
    assert.equal(items.some(item => item.href === '/admin/crm'), role === 'BRANCH_MANAGER');
  }
  const sales = getAdminDestinations(session('SALES_MANAGER'), 'company');
  assert.ok(sales.some(item => item.href === '/admin/crm'));
  assert.ok(!sales.some(item => item.href === '/admin/attendance'));
  assert.ok(!sales.some(item => item.href === '/admin/payroll'));
  assert.equal(filterDestinations(adminDestinations, ' user permissions ')[0].label, 'Roles & access');
  assert.equal(filterDestinations(adminDestinations, 'quotes')[0].label, 'Quotations');
  assert.equal(filterDestinations(employeeDestinations, 'payroll')[0].label, 'Payslips');
});
