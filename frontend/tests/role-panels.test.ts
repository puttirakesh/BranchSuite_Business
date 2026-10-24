import assert from 'node:assert/strict';
import { test } from 'node:test';
import { activeRoleTab, roleTabs, canApprovePayroll, canPreparePayroll, canManageEmployees, companyRoles } from '../src/core/admin/role-capabilities';
import { canOpenAdminPath } from '../src/core/admin/access';
import { payrollAction } from '../src/core/payroll-workflow';
import type { AuthSession } from '../src/core/api/client';

const session = (role: string): AuthSession => ({ user: { id: 'u', name: 'User', email: 'user@example.invalid' }, memberships: [{ id: 'm', tenantId: 't', companyId: 'c', companyName: 'Company', role, permissions: [], branches: [{ id: 'b', name: 'Branch' }] }] });

test('every staff role has the intended mobile panel and company-scoped personal space', () => {
  const expected = {
    BUSINESS_OWNER: ['Home', 'CRM', 'People', 'Payroll', 'More'], BUSINESS_ADMIN: ['Home', 'CRM', 'People', 'Payroll', 'More'],
    COMPANY_MANAGER: ['Home', 'CRM', 'Team', 'Approvals', 'More'], BRANCH_MANAGER: ['Home', 'CRM', 'Team', 'Approvals', 'More'],
    HR_MANAGER: ['Home', 'Team', 'Attendance', 'Approvals', 'More'], PAYROLL_MANAGER: ['Home', 'Team', 'Payroll', 'Payments', 'More'],
    SALES_MANAGER: ['Home', 'Leads', 'Deals', 'Tasks', 'More'],
  };
  for (const [role, labels] of Object.entries(expected)) {
    const auth = session(role);
    assert.deepEqual(roleTabs(companyRoles(auth, 'c')).map(item => item.label), labels);
    for (const path of ['/admin/attendance', '/admin/my-leave', '/admin/my-advances', '/admin/payslips', '/admin/profile/documents']) assert.equal(canOpenAdminPath(auth, 'c', path), true, `${role}: ${path}`);
    assert.equal(canOpenAdminPath(auth, 'other', '/admin/dashboard'), false);
  }
  assert.deepEqual(roleTabs(['EMPLOYEE']), []);
  assert.equal(canOpenAdminPath(session('EMPLOYEE'), 'c', '/admin/dashboard'), false);
});

test('preparation, approval and people management remain independent capabilities', () => {
  for (const role of ['BUSINESS_OWNER', 'BUSINESS_ADMIN', 'PAYROLL_MANAGER']) { assert.ok(canPreparePayroll([role])); assert.equal(canApprovePayroll([role]), false); }
  for (const role of ['COMPANY_MANAGER', 'BRANCH_MANAGER']) { assert.ok(canApprovePayroll([role])); assert.equal(canPreparePayroll([role]), false); assert.equal(canManageEmployees([role]), false); }
  assert.ok(canManageEmployees(['HR_MANAGER']));
  assert.ok(canOpenAdminPath(session('HR_MANAGER'), 'c', '/admin/employees/create'));
  assert.equal(canOpenAdminPath(session('BRANCH_MANAGER'), 'c', '/admin/employees/profile/edit'), false);
  assert.ok(canOpenAdminPath(session('SALES_MANAGER'), 'c', '/admin/tasks'));
  assert.ok(canOpenAdminPath(session('SALES_MANAGER'), 'c', '/admin/reports'));
  assert.equal(canOpenAdminPath(session('SALES_MANAGER'), 'c', '/admin/payroll'), false);
});

test('payroll managers see preparation and publication waiting states and accurate payment navigation', () => {
  const base = { branch: 'North', loading: false, error: '', saving: false, recordCount: 1, checks: 0, canPrepare: false };
  assert.equal(payrollAction(base).kind, 'waiting');
  assert.equal(payrollAction({ ...base, run: { branch: 'North', period: '2026-10', status: 'submitted', submittedAt: '', canApprove: false, publishedAt: null } }).label, 'Awaiting Payslip Publication');
  const tabs = roleTabs(['PAYROLL_MANAGER']);
  assert.equal(activeRoleTab(tabs, '/admin/payroll'), 'Payroll');
  assert.equal(activeRoleTab(tabs, '/admin/payroll', 'payments'), 'Payments');
  assert.ok(canOpenAdminPath(session('PAYROLL_MANAGER'), 'c', '/admin/payroll?view=payments'));
  assert.equal(activeRoleTab(roleTabs(['COMPANY_MANAGER']), '/admin/employees/active-employees'), 'Team');
});
