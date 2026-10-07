import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDemoSession, demoDashboard, demoEnabled, demoList, findDemoAccount, stopDemo } from '../src/services/demo';
import { InputValidationError } from '../src/utils/validation';
test('demo login is explicitly matched to business, account and portal', () => {
  assert.throws(() => findDemoAccount('admin@demo.example', 'Demo123', 't1', 'employee'), InputValidationError);
  assert.throws(() => findDemoAccount('admin@demo.example', 'wrong', 't1', 'staff'), InputValidationError);
  assert.throws(() => createDemoSession('t2', 'admin', 'staff'), InputValidationError);
});
test('employee demos have no CRM permissions and demo scopes cannot cross businesses', () => {
  try {
    const employee = createDemoSession('t1', 'employee', 'employee'); const m = employee.memberships[0];
    assert.deepEqual(m.permissions, []);
    const scope = { tenantId: m.tenantId, companyId: m.companyId, membershipId: m.id, branchId: m.branches[0].id };
    assert.throws(() => demoList(scope, 'leads', '', ''), InputValidationError);
    const staff = createDemoSession('t1', 'admin', 'staff').memberships[0];
    const staffScope = { tenantId: staff.tenantId, companyId: staff.companyId, membershipId: staff.id, branchId: staff.branches[0].id };
    assert.equal(demoDashboard(staffScope).leads, 1);
    assert.throws(() => demoList({ ...staffScope, tenantId: 't2' }, 'leads', '', ''), InputValidationError);
  } finally { stopDemo(); }
  assert.equal(demoEnabled(), false);
});
