/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import ts from 'typescript';
import { validateManualRequest } from '../src/shared/validation/request';
import type { AuthSession, SessionSubscription } from '../src/core/api/client';
import { api } from '../src/core/api/client';
import { apiErrorMessage } from '../src/core/admin/http';
import {
  BILLING_ROUTE,
  billingCopy,
  subscriptionAccess,
  workspaceHome,
} from '../src/features/subscriptions/access';
import { billingApi } from '../src/features/subscriptions/billing.api';
import {
  buildWebCheckoutOptions,
  isCompleteCheckoutResponse,
  lastFailureMessage,
  pollUntil,
  purchaseApplied,
} from '../src/features/subscriptions/checkout';
import { daysLeftLabel, formatDate, formatRupees, remainingDays, shouldShowPlanBanner, statusLabel } from '../src/features/subscriptions/format';
import { describeLimits, formatPlanPrice, plans, resolveSelection } from '../src/features/subscriptions/plans';

const subscription = (overrides: Partial<SessionSubscription> = {}): SessionSubscription => ({
  status: 'ACTIVE', planId: 'scale', billingCycle: 'monthly', accessAllowed: true,
  canManageBilling: true, cancelAtPeriodEnd: false, currentPeriodEnd: null, ...overrides,
});
const session = (sub: SessionSubscription | null | undefined, role = 'BUSINESS_OWNER'): AuthSession => ({
  user: { id: 'u1', name: 'Owner', email: 'owner@example.com' },
  memberships: [{ id: 'm1', tenantId: 't', companyId: 'c', companyName: 'Co', role, roles: [role], permissions: [], branches: [{ id: 'b', name: 'Main' }] }],
  ...(sub === undefined ? {} : { subscription: sub }),
});

// ------------------------------------------------------------------ routing --

test('login/restore routing: ACTIVE business owner goes to the admin dashboard', () => {
  assert.deepEqual(subscriptionAccess(session(subscription())), { kind: 'allowed' });
  assert.equal(workspaceHome(session(subscription())), '/admin');
});

test('login/restore routing: PENDING_ACTIVATION owner goes to payment activation, never the dashboard', () => {
  const pending = session(subscription({ status: 'PENDING_ACTIVATION', accessAllowed: false }));
  assert.deepEqual(subscriptionAccess(pending), { kind: 'billing', reason: 'PENDING_ACTIVATION', canManageBilling: true });
  assert.equal(workspaceHome(pending), BILLING_ROUTE);
});

test('every non-active backend state routes to billing with its own reason', () => {
  for (const status of ['PAST_DUE', 'EXPIRED', 'CANCELLED', 'MISSING'] as const) {
    const access = subscriptionAccess(session(subscription({ status, accessAllowed: false })));
    assert.equal(access.kind, 'billing', status);
    if (access.kind === 'billing') assert.equal(access.reason, status);
  }
  // Active in name but past its paid period => treated as expired, not allowed.
  const ended = subscriptionAccess(session(subscription({ status: 'ACTIVE', accessAllowed: false })));
  assert.deepEqual(ended, { kind: 'billing', reason: 'EXPIRED', canManageBilling: true });
});

test('missing, malformed or unknown subscription state never silently grants access', () => {
  for (const value of [undefined, null, { ...subscription(), status: undefined as unknown as string }]) {
    const access = subscriptionAccess(session(value as SessionSubscription | null | undefined));
    assert.deepEqual(access, { kind: 'billing', reason: 'UNKNOWN', canManageBilling: false });
  }
  const futureStatus = subscriptionAccess(session(subscription({ status: 'SUSPENDED_BY_FUTURE_RELEASE', accessAllowed: true })));
  assert.equal(futureStatus.kind, 'billing');
  assert.equal(subscriptionAccess(null).kind, 'billing');
});

test('accessAllowed=false never allows access even when status says ACTIVE', () => {
  assert.equal(subscriptionAccess(session(subscription({ status: 'ACTIVE', accessAllowed: false }))).kind, 'billing');
});

test('staff and employees of an unpaid business are routed to billing without billing rights', () => {
  for (const role of ['BUSINESS_ADMIN', 'HR_MANAGER', 'EMPLOYEE']) {
    const unpaid = session(subscription({ status: 'PENDING_ACTIVATION', accessAllowed: false, canManageBilling: false }), role);
    const access = subscriptionAccess(unpaid);
    assert.deepEqual(access, { kind: 'billing', reason: 'PENDING_ACTIVATION', canManageBilling: false }, role);
    assert.equal(workspaceHome(unpaid), BILLING_ROUTE);
  }
});

test('paid businesses preserve normal staff and employee destinations', () => {
  assert.equal(workspaceHome(session(subscription({ canManageBilling: false }), 'HR_MANAGER')), '/admin');
  assert.equal(workspaceHome(session(subscription({ canManageBilling: false }), 'EMPLOYEE')), '/employee');
});

test('billing copy: pending says Pay & Activate; expired says the data is retained and offers Renew Plan', () => {
  const pending = billingCopy('PENDING_ACTIVATION');
  assert.equal(pending.actionLabel, 'Pay & Activate');
  assert.match(pending.message, /one-time payment/i);
  assert.match(pending.message, /Nothing renews automatically/);
  for (const reason of ['EXPIRED', 'PAST_DUE', 'CANCELLED'] as const) {
    const copy = billingCopy(reason);
    assert.equal(copy.title, 'Your BranchSuite subscription has expired.', reason);
    assert.equal(copy.message, 'Your business data is safely retained. Renew your plan to restore access.');
    assert.equal(copy.actionLabel, 'Renew Plan');
    assert.equal(copy.canPay, true);
  }
  for (const reason of ['MISSING', 'UNKNOWN'] as const) assert.equal(billingCopy(reason).canPay, false, reason);
  assert.doesNotMatch(JSON.stringify([billingCopy('PENDING_ACTIVATION'), billingCopy('EXPIRED')]), /mandate|auto-?debit|recurring/i);
});

// --------------------------------------------------------------- billing API --

function stubApi(handler: (config: InternalAxiosRequestConfig) => unknown) {
  const original = api.defaults.adapter;
  const seen: InternalAxiosRequestConfig[] = [];
  api.defaults.adapter = async (config) => {
    seen.push(config);
    return { data: handler(config), status: 200, statusText: 'OK', headers: {}, config };
  };
  return { seen, restore: () => { api.defaults.adapter = original; } };
}

test('billing client calls the prepaid backend routes and maps the verify payload to the DTO names', async () => {
  const stub = stubApi(() => ({ ok: true }));
  try {
    await billingApi.status();
    await billingApi.createOrder();
    await billingApi.createOrder({ planId: 'growth', billingCycle: 'annual' });
    await billingApi.refresh();
    await billingApi.verify({ razorpay_payment_id: 'pay_1', razorpay_order_id: 'order_1', razorpay_signature: 'f'.repeat(64) });
    assert.deepEqual(stub.seen.map((c) => [c.method, c.url]), [
      ['get', '/subscriptions/status'],
      ['post', '/subscriptions/orders'],
      ['post', '/subscriptions/orders'],
      ['post', '/subscriptions/refresh'],
      ['post', '/subscriptions/payments/verify'],
    ]);
    // The client never sends an amount or tenant: only an optional plan selection.
    assert.deepEqual(JSON.parse(stub.seen[1].data), {});
    assert.deepEqual(JSON.parse(stub.seen[2].data), { planId: 'growth', billingCycle: 'annual' });
    // Field names must match backend VerifyPaymentDto exactly.
    assert.deepEqual(JSON.parse(stub.seen[4].data), {
      razorpayOrderId: 'order_1', razorpayPaymentId: 'pay_1', razorpaySignature: 'f'.repeat(64),
    });
  } finally { stub.restore(); }
});

// ------------------------------------------------------------------ checkout --

test('web checkout is a one-time ORDER payment: order_id + server amount, never a subscription_id', () => {
  const options = buildWebCheckoutOptions(
    { keyId: 'rzp_test_x', razorpayOrderId: 'order_abc', amount: 599_900, currency: 'INR', planName: 'Scale', billingCycle: 'monthly', purpose: 'ACTIVATION' },
    { onSuccess: () => undefined, onDismiss: () => undefined },
    { name: 'Owner', email: 'owner@example.com' },
  );
  assert.equal(options.key, 'rzp_test_x');
  assert.equal(options.order_id, 'order_abc');
  assert.equal(options.amount, 599_900);
  assert.equal(options.currency, 'INR');
  assert.equal('subscription_id' in options, false, 'no recurring mandate');
  assert.equal(options.description, 'Scale plan · Monthly');
  assert.equal(options.modal.confirm_close, true);
  const renewal = buildWebCheckoutOptions(
    { keyId: 'k', razorpayOrderId: 'order_r', amount: 5_999_000, currency: 'INR', planName: 'Scale', billingCycle: 'annual', purpose: 'RENEWAL' },
    { onSuccess: () => undefined, onDismiss: () => undefined },
  );
  assert.equal(renewal.description, 'Scale plan · Annual renewal');
});

test('a checkout success callback must carry all three order-payment fields to be forwarded', () => {
  assert.equal(isCompleteCheckoutResponse({ razorpay_payment_id: 'pay_1', razorpay_order_id: 'order_1', razorpay_signature: 'abc' }), true);
  for (const bad of [null, {}, { razorpay_payment_id: 'pay_1' }, { razorpay_payment_id: 'x', razorpay_order_id: 'order_1', razorpay_signature: 'a' },
    { razorpay_payment_id: 'pay_1', razorpay_subscription_id: 'sub_1', razorpay_signature: 'a' },
    { razorpay_payment_id: 'pay_1', razorpay_order_id: 'sub_1', razorpay_signature: 'a' }, { razorpay_payment_id: 'pay_1', razorpay_order_id: 'order_1', razorpay_signature: '' }]) {
    assert.equal(isCompleteCheckoutResponse(bad), false);
  }
});

test('activation is confirmed by access; renewal only when the paid-until date has moved', () => {
  const day = 86_400_000;
  const old = Date.now() + 5 * day;
  assert.equal(purchaseApplied({ accessAllowed: false, expiresAt: null }, 0), false);
  assert.equal(purchaseApplied({ accessAllowed: true, expiresAt: new Date(Date.now() + 30 * day).toISOString() }, 0), true);
  // Early renewal: access was already allowed, so it must not count as done until the expiry moves.
  assert.equal(purchaseApplied({ accessAllowed: true, expiresAt: new Date(old).toISOString() }, old), false);
  assert.equal(purchaseApplied({ accessAllowed: true, expiresAt: new Date(old + 30 * day).toISOString() }, old), true);
  assert.equal(purchaseApplied({ accessAllowed: true, expiresAt: null }, old), false);
});

test('billing display helpers: rupees, dates, status wording, remaining days', () => {
  assert.equal(formatRupees(599_900), '₹5,999');
  assert.equal(formatRupees(5_999_000), '₹59,990');
  assert.equal(formatDate(null), '—');
  assert.equal(formatDate('not-a-date'), '—');
  assert.match(formatDate('2026-12-11T10:00:00.000Z'), /11 Dec 2026/);
  assert.equal(statusLabel('EXPIRED'), 'Expired');
  assert.equal(statusLabel('PENDING_ACTIVATION'), 'Awaiting payment');
  assert.equal(daysLeftLabel(1), '1 day remaining');
  assert.equal(daysLeftLabel(23), '23 days remaining');
  // The plan banner is hidden until 7 days before expiry.
  for (const days of [29, 23, 8]) assert.equal(shouldShowPlanBanner(days), false, String(days));
  for (const days of [7, 6, 1, 0]) assert.equal(shouldShowPlanBanner(days), true, String(days));
  assert.equal(daysLeftLabel(0), 'Expires today');
  const now = Date.parse('2026-11-11T10:00:00Z');
  assert.equal(remainingDays('2026-11-12T11:00:00Z', now), 2);
  assert.equal(remainingDays('2026-11-11T09:00:00Z', now), 0);
  assert.equal(remainingDays(null, now), 0);
});

test('polling stops as soon as the backend confirms ACTIVE', async () => {
  let calls = 0;
  const result = await pollUntil({ step: async () => ({ accessAllowed: ++calls >= 3 }), done: (v) => v.accessAllowed, sleep: async () => undefined });
  assert.equal(result.state, 'done');
  assert.equal(calls, 3);
});

test('polling is bounded: it times out instead of looping forever', async () => {
  let calls = 0; let sleeps = 0;
  const result = await pollUntil({ step: async () => { calls++; return { accessAllowed: false }; }, done: (v) => v.accessAllowed, attempts: 5, sleep: async () => { sleeps++; } });
  assert.equal(result.state, 'timeout');
  assert.equal(calls, 5);
  assert.equal(sleeps, 4);
});

test('polling tolerates slow/failing network calls within its budget and can be cancelled', async () => {
  let calls = 0;
  const flaky = await pollUntil({ step: async () => { calls++; if (calls < 3) throw new Error('network'); return { accessAllowed: true }; }, done: (v) => v.accessAllowed, sleep: async () => undefined });
  assert.equal(flaky.state, 'done');
  let stop = false;
  const cancelled = await pollUntil({ step: async () => { stop = true; return { accessAllowed: false }; }, done: (v) => v.accessAllowed, shouldStop: () => stop, sleep: async () => undefined });
  assert.equal(cancelled.state, 'cancelled');
});

test('the latest failed payment is explained to the owner for retry', () => {
  assert.equal(lastFailureMessage([]), null);
  assert.equal(lastFailureMessage([{ status: 'CAPTURED', failureDescription: null, failureCode: null }]), null);
  assert.equal(lastFailureMessage([{ status: 'FAILED', failureDescription: 'Card declined', failureCode: 'X' }]), 'Card declined');
  assert.equal(lastFailureMessage([{ status: 'FAILED', failureDescription: null, failureCode: 'SERVER_ERROR' }]), 'SERVER_ERROR');
});

// -------------------------------------------------------------- signup plans --

test('signup selection never silently falls back to Starter or monthly', () => {
  assert.equal(resolveSelection(undefined, 'monthly'), null);
  assert.equal(resolveSelection('enterprise', 'monthly'), null);
  assert.equal(resolveSelection('growth', 'yearly'), null);
  assert.equal(resolveSelection('growth', undefined)?.billing, 'monthly');
  const chosen = resolveSelection('scale', 'annual');
  assert.equal(chosen?.plan.id, 'scale');
  assert.equal(chosen?.billing, 'annual');
});

test('plan prices and limits shown to the user match the product matrix', () => {
  const byId = Object.fromEntries(plans.map((plan) => [plan.id, plan]));
  assert.deepEqual([byId.starter.monthlyPrice, byId.starter.annualPrice], [999, 9990]);
  assert.deepEqual([byId.growth.monthlyPrice, byId.growth.annualPrice], [2499, 24990]);
  assert.deepEqual([byId.scale.monthlyPrice, byId.scale.annualPrice], [5999, 59990]);
  assert.deepEqual(byId.starter.limits, { employees: 75, branches: 2, companies: 1, staffUsers: 5 });
  assert.deepEqual(byId.growth.limits, { employees: 250, branches: 10, companies: 3, staffUsers: 15 });
  assert.deepEqual(byId.scale.limits, { employees: 1000, branches: 50, companies: 10, staffUsers: 100 });
  assert.equal(formatPlanPrice(byId.scale, 'monthly'), '₹5,999 / month');
  assert.equal(formatPlanPrice(byId.scale, 'annual'), '₹59,990 / year');
  assert.deepEqual(describeLimits(byId.starter.limits), ['Up to 75 employees', '2 branches', '1 company', '5 staff accounts']);
});

// -------------------------------------------------------- 401 / 403 handling --

function clientFixture() {
  const source = readFileSync(new URL('../src/core/api/client.ts', import.meta.url), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  const module: {
    api?: AxiosInstance;
    setAccessToken?: (token: string | null) => void;
    subscribeSessionExpiry?: (listener: () => void) => () => void;
    subscribeSubscriptionRequired?: (listener: () => void) => () => void;
  } = {};
  new Function('require', 'exports', '__DEV__', 'process', 'console', output)(
    (name: string) => {
      if (name === 'axios') return axios;
      if (name === '../../shared/validation/request') return { validateManualRequest };
      throw new Error(`Unexpected dependency: ${name}`);
    }, module, false, { env: { EXPO_PUBLIC_API_URL: 'http://backend.test/api/v1' } }, { log() {}, error() {} },
  );
  return module as Required<typeof module>;
}
const failure = (config: InternalAxiosRequestConfig, status: number, message: string) =>
  new AxiosError('Denied', 'ERR_BAD_REQUEST', config, undefined, { data: { message, statusCode: status }, status, statusText: 'Denied', headers: {}, config });

test('a 403 caused by an inactive subscription notifies the auth layer but keeps the session', async () => {
  const client = clientFixture();
  let expired = 0, required = 0;
  client.subscribeSessionExpiry(() => { expired++; });
  client.subscribeSubscriptionRequired(() => { required++; });
  client.setAccessToken('token');
  client.api.defaults.adapter = async (config) => { throw failure(config, 403, 'An active paid subscription is required to access this business workspace.'); };
  await assert.rejects(client.api.get('/branches/available'));
  assert.equal(required, 1);
  assert.equal(expired, 0);
  assert.equal(client.api.defaults.headers.common.Authorization, 'Bearer token');
});

test('an ordinary permission 403 does not trigger subscription routing or sign-out', async () => {
  const client = clientFixture();
  let expired = 0, required = 0;
  client.subscribeSessionExpiry(() => { expired++; });
  client.subscribeSubscriptionRequired(() => { required++; });
  client.setAccessToken('token');
  client.api.defaults.adapter = async (config) => { throw failure(config, 403, 'Business administrator access required'); };
  await assert.rejects(client.api.get('/users'));
  assert.equal(required, 0);
  assert.equal(expired, 0);
});

test('a 401 still signs the user out (API 401 handling preserved)', async () => {
  const client = clientFixture();
  let expired = 0;
  client.subscribeSessionExpiry(() => { expired++; });
  client.setAccessToken('token');
  client.api.defaults.adapter = async (config) => { throw failure(config, 401, 'Invalid or expired access token'); };
  await assert.rejects(client.api.get('/auth/me'));
  assert.equal(expired, 1);
});

test('a delayed subscription 403 from an older session is ignored', async () => {
  const client = clientFixture();
  let required = 0;
  client.subscribeSubscriptionRequired(() => { required++; });
  client.setAccessToken('new-token');
  client.api.defaults.adapter = async (config) => { throw failure(config, 403, 'An active paid subscription is required'); };
  await assert.rejects(client.api.get('/branches/available', { headers: { Authorization: 'Bearer old-token' } }));
  assert.equal(required, 0);
});

test('user-facing messages: plan limit keeps the server wording, subscription and permission 403s are distinct', () => {
  const make = (status: number, data: Record<string, unknown>) => ({ response: { status, data } });
  assert.equal(
    apiErrorMessage(make(403, { code: 'PLAN_LIMIT_REACHED', message: 'Your plan allows up to 2 branches. Upgrade your plan to add more.' })),
    'Your plan allows up to 2 branches. Upgrade your plan to add more.',
  );
  assert.match(apiErrorMessage(make(403, { message: 'An active paid subscription is required to access this business workspace.' })), /subscription is not active/);
  assert.equal(apiErrorMessage(make(403, { message: 'Business administrator access required' })), 'You do not have permission to do this.');
  assert.match(apiErrorMessage(make(401, {})), /session has expired/);
  assert.match(apiErrorMessage(make(429, {})), /Too many requests/);
});
