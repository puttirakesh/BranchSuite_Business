// Guard / session policy tests (mocked Prisma). Fail-closed subscription access.
require('reflect-metadata');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { Reflector } = require('@nestjs/core');
const { evaluateSubscriptionAccess, sessionSubscription } = require('../src/common/subscription-access');
const { JwtAuthGuard } = require('../src/modules/auth/gaurds/jwt-auth.guard');
const { AllowPendingSubscription } = require('../src/modules/auth/decorators/allow-pending-subscription.decorator');

const future = new Date(Date.now() + 86_400_000);
const past = new Date(Date.now() - 1000);
const record = (overrides = {}) => ({ planId: 'starter', status: 'ACTIVE', expiresAt: null, currentPeriodEnd: null, ...overrides });

test('access policy: only an ACTIVE, in-period subscription on a known plan is allowed', () => {
  assert.deepEqual(evaluateSubscriptionAccess(record()), { allowed: true, reason: 'ACTIVE' });
  assert.equal(evaluateSubscriptionAccess(record({ currentPeriodEnd: future, expiresAt: future })).allowed, true);
  for (const status of ['PENDING_ACTIVATION', 'PAST_DUE', 'EXPIRED', 'CANCELLED', 'SOMETHING_NEW']) {
    assert.equal(evaluateSubscriptionAccess(record({ status })).allowed, false, status);
  }
  assert.equal(evaluateSubscriptionAccess(record({ expiresAt: past })).reason, 'PERIOD_ENDED');
  assert.equal(evaluateSubscriptionAccess(record({ currentPeriodEnd: past })).reason, 'PERIOD_ENDED');
  assert.equal(evaluateSubscriptionAccess(record({ planId: 'platinum' })).reason, 'INVALID_PLAN');
  assert.equal(evaluateSubscriptionAccess(record({ planId: '__proto__' })).allowed, false);
});

test('access policy: a missing record is denied unless the explicit legacy opt-in is set', () => {
  assert.deepEqual(evaluateSubscriptionAccess(null), { allowed: false, reason: 'MISSING' });
  assert.deepEqual(evaluateSubscriptionAccess(undefined), { allowed: false, reason: 'MISSING' });
  process.env.ALLOW_LEGACY_TENANTS_WITHOUT_SUBSCRIPTION = 'true';
  try {
    assert.equal(evaluateSubscriptionAccess(null).allowed, true);
    // The opt-in never rescues a record that exists but is unpaid.
    assert.equal(evaluateSubscriptionAccess(record({ status: 'PENDING_ACTIVATION' })).allowed, false);
  } finally {
    delete process.env.ALLOW_LEGACY_TENANTS_WITHOUT_SUBSCRIPTION;
  }
  process.env.ALLOW_LEGACY_TENANTS_WITHOUT_SUBSCRIPTION = '1';
  try {
    assert.equal(evaluateSubscriptionAccess(null).allowed, false, 'only the literal string "true" enables the bypass');
  } finally {
    delete process.env.ALLOW_LEGACY_TENANTS_WITHOUT_SUBSCRIPTION;
  }
});

function guardFor(subscription, roles = ['BUSINESS_OWNER']) {
  const user = { id: 'u1', tenantId: 'tenant', status: 'ACTIVE', tokenVersion: 0, tenant: { status: 'ACTIVE' },
    roles: roles.map((name) => ({ companyId: null, role: { name } })), companyAccess: [] };
  const prisma = { user: { findUnique: async () => user }, businessSubscription: { findUnique: async () => subscription } };
  const jwt = { verifyAsync: async () => ({ sub: 'u1', tenantId: 'tenant', tokenVersion: 0 }) };
  class Controller { guarded() {} recovery() {} }
  AllowPendingSubscription()(Controller.prototype, 'recovery', Object.getOwnPropertyDescriptor(Controller.prototype, 'recovery'));
  const guard = new JwtAuthGuard(jwt, prisma, new Reflector());
  const context = (handler) => ({
    getHandler: () => handler,
    getClass: () => Controller,
    switchToHttp: () => ({ getRequest: () => ({ headers: { authorization: 'Bearer token' } }) }),
  });
  return { guard, guarded: context(Controller.prototype.guarded), recovery: context(Controller.prototype.recovery) };
}

test('JWT guard fails closed: missing, pending, past-due, cancelled, expired and ended subscriptions are denied', async () => {
  const denied = [null, record({ status: 'PENDING_ACTIVATION' }), record({ status: 'PAST_DUE' }), record({ status: 'CANCELLED' }), record({ status: 'EXPIRED' }), record({ expiresAt: past }), record({ planId: 'nope' })];
  for (const subscription of denied) {
    const { guard, guarded, recovery } = guardFor(subscription);
    await assert.rejects(guard.canActivate(guarded), (error) => error.getStatus() === 403);
    // Billing/recovery routes stay reachable so the owner can pay.
    assert.equal(await guard.canActivate(recovery), true);
  }
  const { guard, guarded } = guardFor(record());
  assert.equal(await guard.canActivate(guarded), true);
});

test('JWT guard denies staff and employees of an unpaid tenant too (tenant-wide, not owner-only)', async () => {
  for (const role of ['BUSINESS_ADMIN', 'HR_MANAGER', 'EMPLOYEE']) {
    const { guard, guarded } = guardFor(record({ status: 'PENDING_ACTIVATION' }), [role]);
    await assert.rejects(guard.canActivate(guarded), (error) => error.getStatus() === 403, role);
  }
});

test('session summary exposes status for routing and billing rights only to the owner', async () => {
  const db = (value) => ({ businessSubscription: { findUnique: async () => value } });
  const pending = await sessionSubscription(db({ ...record({ status: 'PENDING_ACTIVATION' }), billingCycle: 'monthly', cancelAtPeriodEnd: false }), 'tenant', ['BUSINESS_OWNER']);
  assert.equal(pending.status, 'PENDING_ACTIVATION');
  assert.equal(pending.accessAllowed, false);
  assert.equal(pending.canManageBilling, true);
  const staff = await sessionSubscription(db({ ...record(), billingCycle: 'annual', cancelAtPeriodEnd: false, currentPeriodEnd: future }), 'tenant', ['HR_MANAGER']);
  assert.equal(staff.accessAllowed, true);
  assert.equal(staff.canManageBilling, false);
  assert.equal(staff.billingCycle, 'annual');
  const missing = await sessionSubscription(db(null), 'tenant', ['BUSINESS_OWNER']);
  assert.equal(missing.status, 'MISSING');
  assert.equal(missing.accessAllowed, false);
});
