import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reportingManagerOptions } from '../src/core/admin/reporting-managers';
import type { EmployeeProfileDto, UserDto } from '../src/core/admin/api';

function user(id: string, role = 'BRANCH_MANAGER', changes: Partial<UserDto> = {}): UserDto {
  return {
    id, name: id, email: `${id}@example.com`, phone: null, status: 'ACTIVE',
    roles: [{ role: { id: role, name: role } }],
    companyAccess: [{ company: { id: 'company', name: 'Company' } }],
    branchAccess: [{ branch: { id: 'north', name: 'North' } }], createdAt: '', ...changes,
  };
}
function profile(userId: string, changes: Partial<EmployeeProfileDto> = {}): EmployeeProfileDto {
  return {
    id: `profile-${userId}`, tenantId: 'tenant', companyId: 'company', branchId: 'north', userId,
    employeeCode: 'EMP-001', department: 'Sales', designation: 'Regional Sales Head',
    employmentType: 'FULL_TIME', status: 'ACTIVE', joiningDate: '', exitDate: null,
    workEmail: `${userId}@example.com`, notes: null, createdAt: '',
    user: { id: userId, name: userId, email: `${userId}@example.com`, phone: null, status: 'ACTIVE' },
    company: { id: 'company', name: 'Company' }, branch: { id: 'north', name: 'North' }, ...changes,
  };
}

test('employee reporting options include review-capable roles and display designation and department', () => {
  const roles = ['BUSINESS_OWNER', 'BUSINESS_ADMIN', 'COMPANY_MANAGER', 'BRANCH_MANAGER', 'SALES_MANAGER', 'HR_MANAGER', 'PAYROLL_MANAGER'];
  const users = [...roles.map(role => user(role, role)), user('peer', 'EMPLOYEE')];
  const options = reportingManagerOptions(users, [profile('BRANCH_MANAGER')], 'company', 'north');
  assert.equal(options.length, 5);
  assert.equal(options.find(option => option.value === 'BRANCH_MANAGER')?.label, 'BRANCH_MANAGER · Regional Sales Head · Sales');
  assert.ok(!options.some(option => ['SALES_MANAGER', 'PAYROLL_MANAGER'].includes(option.value)));
  assert.ok(!options.some(option => option.value === 'peer'));
  assert.equal(options.find(option => option.value === 'HR_MANAGER')?.label, 'HR_MANAGER · HR Manager');
});

test('options exclude inactive accounts, inactive employment, peers, and employees reporting to themselves', () => {
  const users = [user('inactive', 'HR_MANAGER', { status: 'INACTIVE' }), user('suspended', 'BUSINESS_ADMIN', { status: 'SUSPENDED' }), user('exited'), user('self'), user('peer', 'EMPLOYEE')];
  assert.deepEqual(reportingManagerOptions(users, [profile('exited', { status: 'EXITED' })], 'company', 'north', ' SELF@example.com '), []);
});

test('company and branch assignments restrict managers while the tenant owner can cover all branches', () => {
  const users = [
    user('owner', 'BUSINESS_OWNER', { companyAccess: [], branchAccess: [] }),
    user('other-branch', 'HR_MANAGER', { branchAccess: [{ branch: { id: 'south', name: 'South' } }] }),
    user('other-company', 'SALES_MANAGER', { companyAccess: [{ company: { id: 'other', name: 'Other' } }] }),
    user('local'),
  ];
  assert.deepEqual(reportingManagerOptions(users, [], 'company', 'north').map(option => option.value), ['local', 'owner']);
  assert.deepEqual(reportingManagerOptions(users, [], 'company', 'south').map(option => option.value), ['other-branch', 'owner']);
  assert.deepEqual(reportingManagerOptions(users, [], 'company', ''), []);
});

test('a manager with multiple roles appears once and uses metadata from the selected branch', () => {
  const manager = user('manager', 'EMPLOYEE');
  manager.roles.push({ role: { id: 'hr', name: 'HR_MANAGER' } });
  const options = reportingManagerOptions([manager], [profile('manager', { branchId: 'south', department: 'Other department' }), profile('manager', { designation: '', department: 'People' })], 'company', 'north');
  assert.deepEqual(options, [{ value: 'manager', label: 'manager · HR Manager · People' }]);
});
