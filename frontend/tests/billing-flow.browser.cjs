// Run after npm run export:web: node --test tests/billing-flow.browser.cjs
// Drives the exported Expo Web app in a real browser against a MOCKED backend and a
// STUBBED Razorpay checkout.js. It proves our routing/UI behaviour; it does not
// exercise the real Razorpay service.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, expect } = require('@playwright/test');

const root = path.resolve(__dirname, '../dist');
const branch = { id: 'branch', name: 'Main branch', companyId: 'company', status: 'ACTIVE', manager: '', code: 'MAIN', location: '', employees: 0 };
const user = { id: 'owner', name: 'Test Owner', email: 'owner@example.com', phone: null, status: 'ACTIVE' };
const subscription = (overrides = {}) => ({
  status: 'PENDING_ACTIVATION', planId: 'scale', billingCycle: 'monthly', accessAllowed: false,
  canManageBilling: true, cancelAtPeriodEnd: false, currentPeriodEnd: null, ...overrides,
});
const sessionFor = (sub, role = 'BUSINESS_OWNER') => ({
  user,
  ...(sub === undefined ? {} : { subscription: sub }),
  memberships: [{ id: 'member', tenantId: 'tenant', companyId: 'company', companyName: 'Example', role, roles: [role], permissions: [], branches: [branch] }],
});
const billingStatus = (overrides = {}) => ({
  subscriptionId: 'bs1', plan: { id: 'scale', name: 'Scale' }, billingCycle: 'monthly', amountPaise: 599_900, currency: 'INR',
  status: 'PENDING_ACTIVATION', providerStatus: 'created', accessAllowed: false, activatedAt: null, currentPeriodEnd: null, cancelAtPeriodEnd: false,
  razorpaySubscriptionId: 'sub_test1', keyId: 'rzp_test_fixture', checkoutUrl: 'https://rzp.io/i/fixture', paymentHistory: [], ...overrides,
});
const checkoutSession = () => ({
  subscriptionId: 'bs1', razorpaySubscriptionId: 'sub_test1', checkoutUrl: 'https://rzp.io/i/fixture', keyId: 'rzp_test_fixture',
  plan: { id: 'scale', name: 'Scale' }, billingCycle: 'monthly', amountPaise: 599_900, currency: 'INR', status: 'PENDING_ACTIVATION', providerStatus: 'created', reused: false,
});

const RAZORPAY_STUB = `
window.Razorpay = function (options) { this.options = options; this.handlers = {}; window.__rzpOptions = options; window.__rzpOpened = (window.__rzpOpened || 0); };
window.Razorpay.prototype.on = function (event, callback) { this.handlers[event] = callback; };
window.Razorpay.prototype.open = function () {
  var self = this; window.__rzpOpened += 1; var mode = window.__rzpMode || 'success';
  setTimeout(function () {
    if (mode === 'success') self.options.handler({ razorpay_payment_id: 'pay_test1', razorpay_subscription_id: 'sub_test1', razorpay_signature: 'a'.repeat(64) });
    else if (mode === 'failed') self.handlers['payment.failed']({ error: { description: 'Card mandate could not be created' } });
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
  await page.route('https://checkout.razorpay.com/**', (route) => route.fulfill({ contentType: 'application/javascript', body: RAZORPAY_STUB }));
  await page.route('https://rzp.io/**', (route) => route.fulfill({ contentType: 'text/html', body: '<h1>hosted</h1>' }));
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname.replace(/^.*\/api\/v1/, '');
    state.calls.push(`${request.method()} ${pathname}`);
    const json = (data, status = 200) => route.fulfill({ status, json: data });
    if (pathname === '/auth/login') return json({ accessToken: 'fixture-token', session: state.session() });
    if (pathname === '/auth/me') return json(state.session());
    if (pathname === '/auth/logout') return json({ message: 'ok' });
    if (pathname === '/subscriptions/status' || pathname === '/subscriptions/pending') return state.ownerBilling ? json(state.status()) : json({ message: 'Only the business owner can manage subscription payments.' }, 403);
    if (pathname === '/subscriptions/checkout') { state.checkouts = (state.checkouts || 0) + 1; await new Promise((resolve) => setTimeout(resolve, 150)); return json(checkoutSession(), 201); }
    if (pathname === '/subscriptions/verify') { state.verifyBody = request.postDataJSON(); return json({ verified: true, activated: false, status: 'PENDING_ACTIVATION', providerStatus: 'active', activatedAt: null, message: 'pending' }, 201); }
    if (pathname === '/subscriptions/refresh') { state.refreshes = (state.refreshes || 0) + 1; return json(state.status(), 201); }
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

test('pending owner login lands on payment activation and never calls protected APIs', { timeout: 120000 }, async () => {
  await withApp(async (browser, base) => {
    for (const width of [320, 768, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      const errors = []; page.on('pageerror', (error) => errors.push(error.message));
      const state = { ownerBilling: true, active: false, session: () => sessionFor(subscription()), status: () => billingStatus() };
      await mockBackend(page, state);
      await signIn(page, base);
      await expect(page.getByText('Activate your subscription')).toBeVisible();
      assert.ok(page.url().endsWith('/billing'), `landed on ${page.url()}`);
      await expect(page.getByText('Scale', { exact: true })).toBeVisible();
      await expect(page.getByText('₹5,999 / month')).toBeVisible();
      await expect(page.getByText('Monthly (billed every month)')).toBeVisible();
      await expect(page.getByText('Awaiting payment')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Pay & activate' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Refresh status' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
      await expect(page.getByText('Test Mode', { exact: false })).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.ok(overflow <= 1, `no horizontal scroll at ${width}px (overflow ${overflow})`);
      assert.deepEqual(state.protectedCalls, [], 'no dashboard/branches API call while payment is pending');
      assert.deepEqual(errors, []);
      await context.close();
    }
  });
});

test('payment success: checkout is created once, verified server-side, then the dashboard opens only after ACTIVE', { timeout: 120000 }, async () => {
  await withApp(async (browser, base) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    const state = { ownerBilling: true, active: false, session: () => sessionFor(state.active ? subscription({ status: 'ACTIVE', accessAllowed: true }) : subscription()), status: () => billingStatus(state.active ? { status: 'ACTIVE', accessAllowed: true, providerStatus: 'active' } : {}) };
    await mockBackend(page, state);
    await signIn(page, base);
    await expect(page.getByRole('button', { name: 'Pay & activate' })).toBeVisible();
    await page.evaluate(() => { window.__rzpMode = 'success'; });
    // Repeated taps must not create duplicate subscriptions (client-side dedupe + backend reuse).
    const pay = page.getByRole('button', { name: 'Pay & activate' });
    await pay.dblclick();
    await expect(page.getByText(/Waiting for Razorpay to confirm/)).toBeVisible({ timeout: 15000 });
    assert.equal(state.checkouts, 1, 'a double tap created exactly one checkout request');
    const options = await page.evaluate(() => window.__rzpOptions);
    assert.equal(options.subscription_id, 'sub_test1');
    assert.equal(options.key, 'rzp_test_fixture');
    assert.equal('amount' in options, false);
    assert.equal('order_id' in options, false);
    assert.deepEqual(state.verifyBody, { razorpayPaymentId: 'pay_test1', razorpaySubscriptionId: 'sub_test1', razorpaySignature: 'a'.repeat(64) });
    // The success callback alone does NOT open the workspace.
    assert.ok(page.url().endsWith('/billing'));
    assert.deepEqual(state.protectedCalls, []);
    // Razorpay/webhook confirm: backend now reports ACTIVE.
    state.active = true;
    await page.waitForURL(/\/admin/, { timeout: 30000 });
    await expect(page.getByText('Activate your subscription')).toHaveCount(0);
    await context.close();
  });
});

test('payment failure and checkout cancellation show clear messages and allow retry', { timeout: 120000 }, async () => {
  await withApp(async (browser, base) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    const state = { ownerBilling: true, active: false, session: () => sessionFor(subscription()), status: () => billingStatus({ paymentHistory: state.failed ? [{ id: 'p1', providerPaymentId: 'pay_failed', amountPaise: 599_900, currency: 'INR', status: 'FAILED', failureCode: 'SERVER_ERROR', failureDescription: 'Card mandate could not be created', capturedAt: null, createdAt: new Date().toISOString() }] : [] }) };
    await mockBackend(page, state);
    await signIn(page, base);
    await page.evaluate(() => { window.__rzpMode = 'dismissed'; });
    await page.getByRole('button', { name: 'Pay & activate' }).click();
    await expect(page.getByText(/Checkout was closed/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pay & activate' })).toBeEnabled();

    state.failed = true;
    await page.evaluate(() => { window.__rzpMode = 'failed'; });
    await page.getByRole('button', { name: 'Pay & activate' }).click();
    await expect(page.getByText(/Payment failed: Card mandate could not be created/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Retry authorisation' })).toBeVisible();
    assert.ok(page.url().endsWith('/billing'));
    assert.deepEqual(state.protectedCalls, []);
    assert.equal(state.verifyBody, undefined, 'failed or cancelled checkouts are never sent for verification');
    await context.close();
  });
});

test('app restart / browser refresh / deep link while pending stays on billing; active deep link opens the app', { timeout: 120000 }, async () => {
  await withApp(async (browser, base) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.addInitScript(() => sessionStorage.setItem('branchsuite_access_token', 'fixture-token'));
    const page = await context.newPage();
    const state = { ownerBilling: true, active: false, session: () => sessionFor(state.active ? subscription({ status: 'ACTIVE', accessAllowed: true }) : subscription()), status: () => billingStatus() };
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
    assert.deepEqual(state.protectedCalls, [], 'deep links never reach protected APIs while pending');
    // Once paid, the same deep link opens the dashboard.
    state.active = true;
    await page.goto(`${base}/admin/dashboard`);
    await page.waitForURL(/\/admin\/dashboard/);
    await expect(page.getByText('Activate your subscription')).toHaveCount(0);
    await context.close();
  });
});

test('non-owner staff of an unpaid business see an explanation, no payment button, and can sign out', { timeout: 120000 }, async () => {
  await withApp(async (browser, base) => {
    const context = await browser.newContext({ viewport: { width: 800, height: 900 } });
    const page = await context.newPage();
    const state = { ownerBilling: false, active: false, session: () => sessionFor(subscription({ canManageBilling: false }), 'BUSINESS_ADMIN'), status: () => billingStatus() };
    await mockBackend(page, state);
    await signIn(page, base);
    await expect(page.getByText(/Only the business owner can manage billing/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pay & activate' })).toHaveCount(0);
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
    const state = { ownerBilling: true, active: true, session: () => sessionFor(subscription({ status: 'ACTIVE', accessAllowed: true })), status: () => billingStatus({ status: 'ACTIVE', accessAllowed: true }) };
    await mockBackend(page, state);
    await signIn(page, base);
    await page.waitForURL(/\/admin/, { timeout: 30000 });
    assert.ok(!page.url().includes('/billing'));
    await context.close();
  });
});
