// Run after npm run export:web: node --test tests/billing-flow.browser.cjs
// Drives the exported Expo Web app in a real browser against a MOCKED backend and a
// STUBBED Razorpay checkout.js. It proves our routing/UI behaviour for prepaid
// one-time payments and manual renewal; it does not exercise the real Razorpay service.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, expect } = require('@playwright/test');

const root = path.resolve(__dirname, '../dist');
const DAY = 86_400_000;
const branch = { id: 'branch', name: 'Main branch', companyId: 'company', status: 'ACTIVE', manager: '', code: 'MAIN', location: '', employees: 0 };
const user = { id: 'owner', name: 'Test Owner', email: 'owner@example.com', phone: null, status: 'ACTIVE' };
const subscription = (overrides = {}) => ({
  status: 'PENDING_ACTIVATION', planId: 'scale', billingCycle: 'monthly', accessAllowed: false,
  canManageBilling: true, cancelAtPeriodEnd: false, currentPeriodEnd: null, expiresAt: null, billingModel: 'PREPAID', ...overrides,
});
const activeSub = (days = 23) => subscription({ status: 'ACTIVE', accessAllowed: true, expiresAt: new Date(Date.now() + days * DAY).toISOString(), currentPeriodEnd: new Date(Date.now() + days * DAY).toISOString() });
const expiredSub = () => subscription({ status: 'EXPIRED', accessAllowed: false, expiresAt: new Date(Date.now() - 3 * DAY).toISOString() });
const sessionFor = (sub, role = 'BUSINESS_OWNER') => ({
  user,
  ...(sub === undefined ? {} : { subscription: sub }),
  memberships: [{ id: 'member', tenantId: 'tenant', companyId: 'company', companyName: 'Example', role, roles: [role], permissions: [], branches: [branch] }],
});
const billingStatus = (overrides = {}) => ({
  subscriptionId: 'bs1', plan: { id: 'scale', name: 'Scale' }, billingCycle: 'monthly', amountPaise: 599_900, currency: 'INR',
  status: 'PENDING_ACTIVATION', accessAllowed: false, billingModel: 'PREPAID', purpose: 'ACTIVATION', activatedAt: null,
  currentPeriodStart: null, expiresAt: null, daysRemaining: 0, lastPaymentAt: null, canPay: true, payBlockedReason: null,
  openOrder: null, hasLegacyRecurringSubscription: false, paymentHistory: [], ...overrides,
});
const orderResponse = (purpose = 'ACTIVATION') => ({
  orderId: 'ord-1', razorpayOrderId: 'order_test1', keyId: 'rzp_test_fixture', amount: 599_900, currency: 'INR', planId: 'scale',
  planName: 'Scale', billingCycle: 'monthly', purpose, reused: false, hostedCheckoutUrl: 'https://api.example.test/api/v1/subscriptions/checkout-page/ord-1?t=1.abc',
});

const RAZORPAY_STUB = `
window.Razorpay = function (options) { this.options = options; this.handlers = {}; window.__rzpOptions = options; window.__rzpOpened = (window.__rzpOpened || 0); };
window.Razorpay.prototype.on = function (event, callback) { this.handlers[event] = callback; };
window.Razorpay.prototype.open = function () {
  var self = this; window.__rzpOpened += 1; var mode = window.__rzpMode || 'success';
  setTimeout(function () {
    if (mode === 'success') self.options.handler({ razorpay_payment_id: 'pay_test1', razorpay_order_id: self.options.order_id, razorpay_signature: 'a'.repeat(64) });
    else if (mode === 'failed') self.handlers['payment.failed']({ error: { description: 'Card could not be charged' } });
    else self.options.modal.ondismiss();
  }, 30);
};`;

async function withApp(run) {
  const server = http.createServer((request, response) => {
    const requested = path.resolve(root, '.' + decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
    if (!requested.startsWith(root + path.sep) && requested !== root) return response.writeHead(403).end();
    const file = fs.existsSync(requested) && fs.statSync(requested).isFile() ? requested : path.join(root, 'index.html');
    response.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.ttf': 'font/ttf' })[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(response);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
    await run(browser, base);
  } finally {
    await browser?.close();
    server.close();
  }
}

/** Mock backend. `state` is mutated by tests to change responses between steps. */
async function mockBackend(page, state) {
  state.calls = [];
  state.protectedCalls = [];
  state.orders = 0;
  await page.route('https://checkout.razorpay.com/**', (route) => route.fulfill({ contentType: 'application/javascript', body: RAZORPAY_STUB }));
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname.replace(/^.*\/api\/v1/, '');
    state.calls.push(`${request.method()} ${pathname}`);
    const json = (data, status = 200) => route.fulfill({ status, json: data });
    if (pathname === '/auth/login') return json({ accessToken: 'fixture-token', session: state.session() });
    if (pathname === '/auth/me') return json(state.session());
    if (pathname === '/auth/logout') return json({ message: 'ok' });
    if (pathname === '/subscriptions/status') return state.ownerBilling ? json(state.status()) : json({ message: 'Only the business owner can manage subscription payments.' }, 403);
    if (pathname === '/subscriptions/orders') { state.orders += 1; state.orderBody = request.postDataJSON(); await new Promise((resolve) => setTimeout(resolve, 150)); return json(orderResponse(state.purpose || 'ACTIVATION'), 201); }
    if (pathname === '/subscriptions/payments/verify') { state.verifyBody = request.postDataJSON(); return json({ verified: true, state: 'PENDING', message: 'not captured yet', activated: false, status: 'PENDING_ACTIVATION', expiresAt: null }); }
    if (pathname === '/subscriptions/refresh') { state.refreshes = (state.refreshes || 0) + 1; return json(state.status()); }
    if (pathname === '/subscriptions/current') {
      return json({ id: 'bs1', planId: 'scale', billingCycle: 'monthly', status: 'ACTIVE', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), currentPeriodEnd: state.session().subscription.expiresAt, expiresAt: state.session().subscription.expiresAt,
        limits: { companies: 10, branches: 50, employees: 1000, users: 100 }, usage: { companies: 1, branches: 1, employees: 3, users: 2 } });
    }
    // Everything else is a protected business API.
    state.protectedCalls.push(pathname);
    if (!state.active) return json({ message: 'An active paid subscription is required to access this business workspace.', statusCode: 403 }, 403);
    const data = pathname.includes('available') || pathname.endsWith('/branches') ? [branch]
      : new URL(request.url()).searchParams.has('page') ? { data: [], pagination: { page: 1, totalPages: 1, total: 0 } } : [];
    return json(data);
  });
}

async function signIn(page, base) {
  await page.goto(`${base}/auth/login`);
  await page.getByLabel('Work email', { exact: true }).fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill('valid-password');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
}

const pendingState = () => {
  const state = { ownerBilling: true, active: false, session: () => sessionFor(state.active ? activeSub() : subscription()), status: () => billingStatus(state.active ? { status: 'ACTIVE', accessAllowed: true, expiresAt: activeSub().expiresAt, purpose: 'RENEWAL', daysRemaining: 23 } : {}) };
  return state;
};

test('pending owner login lands on Pay & Activate and never calls protected APIs', { timeout: 120000 }, async () => {
  await withApp(async (browser, base) => {
    for (const width of [320, 768, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      const errors = []; page.on('pageerror', (error) => errors.push(error.message));
      const state = pendingState();
      await mockBackend(page, state);
      await signIn(page, base);
      await expect(page.getByText('Activate your subscription')).toBeVisible();
      assert.ok(page.url().endsWith('/billing'), `landed on ${page.url()}`);
      await expect(page.getByText('Scale', { exact: true })).toBeVisible();
      await expect(page.getByText('₹5,999 / month')).toBeVisible();
      await expect(page.getByText('1 month per payment')).toBeVisible();
      await expect(page.getByText('Awaiting payment')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Pay & Activate' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Refresh status' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
      await expect(page.getByText(/One-time payment/)).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.ok(overflow <= 1, `no horizontal scroll at ${width}px (overflow ${overflow})`);
      assert.deepEqual(state.protectedCalls, [], 'no dashboard/branches API call while payment is pending');
      assert.deepEqual(errors, []);
      await context.close();
    }
  });
});

test('payment success: one order, server amount, verify, then the dashboard opens only after the backend confirms', { timeout: 120000 }, async () => {
  await withApp(async (browser, base) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    const state = pendingState();
    await mockBackend(page, state);
    await signIn(page, base);
    await expect(page.getByRole('button', { name: 'Pay & Activate' })).toBeVisible();
    await page.evaluate(() => { window.__rzpMode = 'success'; });
    await page.getByRole('button', { name: 'Pay & Activate' }).dblclick(); // double press
    await expect(page.getByText(/Waiting for Razorpay to confirm/)).toBeVisible({ timeout: 15000 });
    assert.equal(state.orders, 1, 'a double tap created exactly one order request');
    assert.deepEqual(state.orderBody, {}, 'the client sends no amount or tenant');
    const options = await page.evaluate(() => window.__rzpOptions);
    assert.equal(options.order_id, 'order_test1');
    assert.equal(options.amount, 599_900);
    assert.equal(options.currency, 'INR');
    assert.equal(options.key, 'rzp_test_fixture');
    assert.equal('subscription_id' in options, false, 'no recurring mandate');
    assert.deepEqual(state.verifyBody, { razorpayOrderId: 'order_test1', razorpayPaymentId: 'pay_test1', razorpaySignature: 'a'.repeat(64) });
    // The checkout success callback alone does NOT open the workspace.
    assert.ok(page.url().endsWith('/billing'));
    assert.deepEqual(state.protectedCalls, []);
    // Razorpay captured; the backend now reports ACTIVE.
    state.active = true;
    await page.waitForURL(/\/admin/, { timeout: 30000 });
    await expect(page.getByText('Activate your subscription')).toHaveCount(0);
    await expect(page.getByTestId('plan-validity-banner')).toContainText('Scale plan');
    await expect(page.getByTestId('plan-validity-banner')).toContainText('days remaining');
    await context.close();
  });
});

test('payment failure and checkout cancellation show clear messages and allow retry', { timeout: 120000 }, async () => {
  await withApp(async (browser, base) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    const state = pendingState();
    state.status = () => billingStatus({ paymentHistory: state.failed ? [{ id: 'p1', providerPaymentId: 'pay_failed', providerOrderId: 'order_test1', amountPaise: 599_900, currency: 'INR', status: 'FAILED', method: 'card', failureCode: 'BAD_REQUEST_ERROR', failureDescription: 'Card could not be charged', capturedAt: null, createdAt: new Date().toISOString() }] : [] });
    await mockBackend(page, state);
    await signIn(page, base);
    await page.evaluate(() => { window.__rzpMode = 'dismissed'; });
    await page.getByRole('button', { name: 'Pay & Activate' }).click();
    await expect(page.getByText(/Checkout was closed/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pay & Activate' })).toBeEnabled();

    state.failed = true;
    await page.evaluate(() => { window.__rzpMode = 'failed'; });
    await page.getByRole('button', { name: 'Pay & Activate' }).click();
    await expect(page.getByText(/Payment failed: Card could not be charged/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Retry payment' })).toBeVisible();
    assert.ok(page.url().endsWith('/billing'));
    assert.deepEqual(state.protectedCalls, []);
    assert.equal(state.verifyBody, undefined, 'failed or cancelled checkouts are never sent for verification');
    await context.close();
  });
});

test('slow confirmation shows a bounded waiting state and never grants access early', { timeout: 120000 }, async () => {
  await withApp(async (browser, base) => {
    const context = await browser.newContext({ viewport: { width: 900, height: 900 } });
    const page = await context.newPage();
    const state = pendingState();
    await mockBackend(page, state);
    await signIn(page, base);
    await page.evaluate(() => { window.__rzpMode = 'success'; });
    await page.getByRole('button', { name: 'Pay & Activate' }).click();
    await expect(page.getByText(/Waiting for Razorpay to confirm/)).toBeVisible({ timeout: 15000 });
    assert.ok(page.url().endsWith('/billing'));
    assert.deepEqual(state.protectedCalls, []);
    await context.close();
  });
});

test('refresh / restart / deep link while unpaid stays on billing; once paid the same link opens the app', { timeout: 120000 }, async () => {
  await withApp(async (browser, base) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.addInitScript(() => sessionStorage.setItem('branchsuite_access_token', 'fixture-token'));
    const page = await context.newPage();
    const state = pendingState();
    await mockBackend(page, state);
    await page.goto(`${base}/admin/dashboard`);
    await expect(page.getByText('Activate your subscription')).toBeVisible();
    assert.ok(page.url().endsWith('/billing'));
    await page.reload();
    await expect(page.getByText('Activate your subscription')).toBeVisible();
    await page.goto(`${base}/`);
    await expect(page.getByText('Activate your subscription')).toBeVisible();
    await page.goto(`${base}/employee`);
    await expect(page.getByText('Activate your subscription')).toBeVisible();
    assert.deepEqual(state.protectedCalls, [], 'deep links never reach protected APIs while unpaid');
    state.active = true;
    await page.goto(`${base}/admin/dashboard`);
    await page.waitForURL(/\/admin\/dashboard/);
    await expect(page.getByText('Activate your subscription')).toHaveCount(0);
    await context.close();
  });
});

test('expired owner sees the expiry screen with retained-data message, plan details and Renew Plan, then renews manually', { timeout: 120000 }, async () => {
  await withApp(async (browser, base) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    const state = {
      ownerBilling: true, active: false, purpose: 'RENEWAL',
      session: () => sessionFor(state.active ? activeSub(30) : expiredSub()),
      status: () => state.active
        ? billingStatus({ status: 'ACTIVE', accessAllowed: true, purpose: 'RENEWAL', expiresAt: activeSub(30).expiresAt, daysRemaining: 30 })
        : billingStatus({ status: 'EXPIRED', purpose: 'RENEWAL', expiresAt: expiredSub().expiresAt, activatedAt: new Date(Date.now() - 33 * DAY).toISOString(), lastPaymentAt: new Date(Date.now() - 33 * DAY).toISOString(),
          paymentHistory: [{ id: 'p0', providerPaymentId: 'pay_old', providerOrderId: 'order_old', amountPaise: 599_900, currency: 'INR', status: 'CAPTURED', method: 'card', failureCode: null, failureDescription: null, capturedAt: new Date(Date.now() - 33 * DAY).toISOString(), createdAt: new Date(Date.now() - 33 * DAY).toISOString() }] }),
    };
    await mockBackend(page, state);
    await signIn(page, base);
    await expect(page.getByText('Your BranchSuite subscription has expired.')).toBeVisible();
    await expect(page.getByText('Your business data is safely retained. Renew your plan to restore access.')).toBeVisible();
    assert.ok(page.url().endsWith('/billing'));
    await expect(page.getByText('Expired', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Expired on')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Renew Plan' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
    await page.getByRole('button', { name: 'View Plan Details' }).click();
    await expect(page.getByText('Payment history')).toBeVisible();
    await expect(page.getByText('Paid', { exact: true })).toBeVisible();
    assert.deepEqual(state.protectedCalls, []);

    await page.evaluate(() => { window.__rzpMode = 'success'; });
    await page.getByRole('button', { name: 'Renew Plan' }).click();
    await expect(page.getByText(/Waiting for Razorpay to confirm/)).toBeVisible({ timeout: 15000 });
    assert.equal(state.orders, 1);
    state.active = true;
    await page.waitForURL(/\/admin/, { timeout: 30000 });
    await context.close();
  });
});

test('active owner sees validity, history and can renew early from the subscription page', { timeout: 120000 }, async () => {
  await withApp(async (browser, base) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    const expiry = { value: activeSub(5).expiresAt };
    const state = {
      ownerBilling: true, active: true, purpose: 'RENEWAL',
      session: () => sessionFor(subscription({ status: 'ACTIVE', accessAllowed: true, expiresAt: expiry.value, currentPeriodEnd: expiry.value })),
      status: () => billingStatus({ status: 'ACTIVE', accessAllowed: true, purpose: 'RENEWAL', expiresAt: expiry.value, daysRemaining: 5, activatedAt: new Date(Date.now() - 25 * DAY).toISOString(), currentPeriodStart: new Date(Date.now() - 25 * DAY).toISOString(), lastPaymentAt: new Date(Date.now() - 25 * DAY).toISOString() }),
    };
    await mockBackend(page, state);
    await signIn(page, base);
    await page.waitForURL(/\/admin/, { timeout: 30000 });
    await expect(page.getByTestId('plan-validity-banner')).toContainText('5 days remaining');
    await expect(page.getByTestId('plan-validity-banner')).toContainText('Renew now');
    await page.goto(`${base}/admin/subscription`);
    await expect(page.getByLabel('Plan validity')).toBeVisible();
    await expect(page.getByText('5 days remaining')).toBeVisible();
    await expect(page.getByText('Renewal price')).toBeVisible();
    await expect(page.getByLabel('Payment history')).toBeVisible();
    await page.evaluate(() => { window.__rzpMode = 'success'; });
    await page.getByRole('button', { name: 'Renew Plan' }).click();
    await expect(page.getByText(/Waiting for Razorpay to confirm/)).toBeVisible({ timeout: 15000 });
    assert.equal(state.orders, 1);
    // Access was already allowed: the renewal counts only once the paid-until date moves.
    assert.equal(await page.getByText(/Payment confirmed\./).count(), 0);
    expiry.value = activeSub(35).expiresAt;
    await expect(page.getByText(/Payment confirmed\./)).toBeVisible({ timeout: 30000 });
    await context.close();
  });
});

test('non-owner staff of an unpaid business see an explanation, no pay button, and can sign out', { timeout: 120000 }, async () => {
  await withApp(async (browser, base) => {
    const context = await browser.newContext({ viewport: { width: 800, height: 900 } });
    const page = await context.newPage();
    const state = { ownerBilling: false, active: false, session: () => sessionFor(subscription({ canManageBilling: false }), 'BUSINESS_ADMIN'), status: () => billingStatus() };
    await mockBackend(page, state);
    await signIn(page, base);
    await expect(page.getByText(/Only the business owner can manage billing/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pay & Activate' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Renew Plan' })).toHaveCount(0);
    assert.ok(!state.calls.includes('GET /subscriptions/status'), 'staff never call owner-only billing endpoints');
    assert.deepEqual(state.protectedCalls, []);
    await page.getByRole('button', { name: 'Sign out' }).click();
    await page.waitForURL(/\/auth\/login/);
    await context.close();
  });
});

test('a missing subscription summary is shown as an error, never as access', { timeout: 120000 }, async () => {
  await withApp(async (browser, base) => {
    const context = await browser.newContext({ viewport: { width: 800, height: 900 } });
    const page = await context.newPage();
    const state = { ownerBilling: true, active: true, session: () => sessionFor(undefined), status: () => billingStatus() };
    await mockBackend(page, state);
    await signIn(page, base);
    await expect(page.getByText('Unable to verify your subscription')).toBeVisible();
    assert.deepEqual(state.protectedCalls, []);
    await context.close();
  });
});

test('an ACTIVE owner signs in straight to the dashboard', { timeout: 120000 }, async () => {
  await withApp(async (browser, base) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    const state = { ownerBilling: true, active: true, session: () => sessionFor(activeSub()), status: () => billingStatus({ status: 'ACTIVE', accessAllowed: true }) };
    await mockBackend(page, state);
    await signIn(page, base);
    await page.waitForURL(/\/admin/, { timeout: 30000 });
    assert.ok(!page.url().includes('/billing'));
    await context.close();
  });
});
