import { test } from 'node:test';
import assert from 'node:assert/strict';
import { can } from '../src/core/permissions/roles';

test('platform admin can use every module', () => {
  for (const c of ['plans.manage', 'billing.view', 'marketing.manage', 'offers.manage', 'settings.manage', 'audit.view', 'customers.manageLicence'] as const)
    assert.equal(can('PLATFORM_ADMIN', c), true, c);
});
test('platform support is limited to overview, customers and support (APK rules)', () => {
  for (const c of ['dashboard.view', 'customers.view', 'support.view', 'support.reply', 'support.internalNote'] as const) assert.equal(can('PLATFORM_SUPPORT', c), true, c);
  for (const c of ['plans.manage', 'billing.view', 'marketing.manage', 'offers.manage', 'settings.manage', 'audit.view', 'customers.manageLicence', 'support.changeStatus'] as const)
    assert.equal(can('PLATFORM_SUPPORT', c), false, c);
});
test('no role means no access', () => {
  assert.equal(can(null, 'dashboard.view'), false);
});
