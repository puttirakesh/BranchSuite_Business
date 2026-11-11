// MOCKED tests: an in-memory Prisma double and a fake Razorpay provider. They
// prove our logic, NOT real Razorpay behaviour (see the verification report).
require('reflect-metadata');
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const { test } = require('node:test');
const { Prisma } = require('@prisma/client');
const { SubscriptionsService } = require('../src/modules/subscriptions/subscriptions.service');
const {
  RazorpayHttpProvider,
  assertRazorpayKeyModeAllowed,
} = require('../src/modules/subscriptions/razorpay.provider');
const { NotFoundException, ServiceUnavailableException } = require('@nestjs/common');

const PLAN_ENV = {
  RAZORPAY_PLAN_STARTER_MONTHLY: 'plan_StarterMonthly',
  RAZORPAY_PLAN_STARTER_ANNUAL: 'plan_StarterAnnual',
  RAZORPAY_PLAN_GROWTH_MONTHLY: 'plan_GrowthMonthly',
  RAZORPAY_PLAN_GROWTH_ANNUAL: 'plan_GrowthAnnual',
  RAZORPAY_PLAN_SCALE_MONTHLY: 'plan_ScaleMonthly',
  RAZORPAY_PLAN_SCALE_ANNUAL: 'plan_ScaleAnnual',
};
Object.assign(process.env, PLAN_ENV, {
  RAZORPAY_KEY_SECRET: 'test-key-secret',
  RAZORPAY_WEBHOOK_SECRET: 'test-webhook-secret',
});

const NOW = Math.floor(Date.now() / 1000);
const DAY = 86_400;

const baseRow = (overrides = {}) => ({
  id: 'business-subscription-id',
  tenantId: 'tenant-id',
  planId: 'starter',
  billingCycle: 'monthly',
  status: 'PENDING_ACTIVATION',
  razorpaySubscriptionId: 'sub_test123',
  providerStatus: null,
  providerCheckoutUrl: null,
  activatedAt: null,
  currentPeriodStart: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  cancelledAt: null,
  expiresAt: null,
  ...overrides,
});

class FakeRazorpay {
  constructor() {
    this.created = [];
    this.cancelled = [];
    this.nextId = 1;
    this.remote = {
      id: 'sub_test123',
      plan_id: 'plan_StarterMonthly',
      status: 'created',
      short_url: 'https://rzp.io/i/test',
      current_start: null,
      current_end: null,
    };
    // Realistic payment entity: has invoice_id/order_id and NO subscription_id.
    this.payments = {
      pay_test123: {
        id: 'pay_test123',
        invoice_id: 'inv_test123',
        order_id: 'order_test123',
        amount: 99_900,
        currency: 'INR',
        status: 'captured',
        created_at: NOW,
      },
    };
    this.invoices = {
      inv_test123: { id: 'inv_test123', subscription_id: 'sub_test123', payment_id: 'pay_test123', status: 'paid', amount: 99_900, currency: 'INR' },
    };
    this.getSubscriptionError = null;
    this.createError = null;
  }
  async createSubscription(input) {
    if (this.createError) throw this.createError;
    const id = `sub_new${this.nextId++}`;
    this.created.push({ ...input, id });
    const created = { id, plan_id: PLAN_ENV[`RAZORPAY_PLAN_${input.planId.toUpperCase()}_${input.billingCycle.toUpperCase()}`], status: 'created', short_url: `https://rzp.io/i/${id}` };
    this.remote = { ...created };
    return created;
  }
  async getSubscription(id) {
    if (this.getSubscriptionError) throw this.getSubscriptionError;
    if (id !== this.remote.id) throw new NotFoundException('missing');
    return { ...this.remote };
  }
  async cancelSubscription(id) { this.cancelled.push(id); }
  async getPayment(id) {
    if (!this.payments[id]) throw new NotFoundException('missing');
    return { ...this.payments[id] };
  }
  async getInvoice(id) {
    if (!this.invoices[id]) throw new NotFoundException('missing');
    return { ...this.invoices[id] };
  }
  async listSubscriptionInvoices(id) {
    return Object.values(this.invoices).filter((invoice) => invoice.subscription_id === id);
  }
  publicKeyId() { return 'rzp_test_public'; }
}

function fixture(rowOverrides = {}) {
  const rows = [baseRow(rowOverrides), baseRow({ id: 'other-subscription-id', tenantId: 'other-tenant', razorpaySubscriptionId: 'sub_other999' })];
  const payments = new Map();
  const webhookEvents = new Map();
  const provider = new FakeRazorpay();
  const find = (where) => {
    const key = Object.keys(where)[0];
    return rows.find((row) => row[key] === where[key]);
  };
  const locks = [];
  const state = { failNextUpdate: false };
  const tx = {
    $executeRaw: async (strings, ...values) => { locks.push([strings.join('?'), ...values]); return 1; },
    businessSubscription: {
      findUnique: async ({ where, include }) => {
        const row = find(where);
        if (!row) return null;
        const copy = { ...row };
        if (include?.payments) copy.payments = [...payments.values()].filter((p) => p.subscriptionId === row.id);
        return copy;
      },
      update: async ({ where, data }) => {
        if (state.failNextUpdate) { state.failNextUpdate = false; throw new Error('database write failed'); }
        return { ...Object.assign(find(where), data) };
      },
      updateMany: async ({ where, data }) => {
        const row = rows.find((r) => r.tenantId === where.tenantId && r.status === where.status);
        if (!row) return { count: 0 };
        const ended = (row.expiresAt && row.expiresAt <= new Date()) || (row.currentPeriodEnd && row.currentPeriodEnd <= new Date());
        if (!ended) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      },
    },
    subscriptionPayment: {
      findUnique: async ({ where }) => payments.get(where.providerPaymentId) ?? null,
      findFirst: async ({ where }) => {
        for (const payment of payments.values()) {
          if (Object.entries(where).every(([key, value]) => payment[key] === value)) return { id: payment.id };
        }
        return null;
      },
      upsert: async ({ where, create, update }) => {
        const previous = payments.get(where.providerPaymentId);
        const value = previous ? Object.assign(previous, update) : { id: `payment-${payments.size + 1}`, ...create };
        payments.set(where.providerPaymentId, value);
        return value;
      },
    },
    razorpayWebhookEvent: {
      create: async ({ data }) => {
        if (webhookEvents.has(data.providerEventId)) {
          throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: '6.19.3' });
        }
        webhookEvents.set(data.providerEventId, { id: data.providerEventId, ...data });
        return webhookEvents.get(data.providerEventId);
      },
      update: async ({ where, data }) => Object.assign(webhookEvents.get(where.providerEventId), data),
      findUnique: async ({ where }) => webhookEvents.get(where.providerEventId) ?? null,
    },
  };
  const prisma = {
    businessSubscription: tx.businessSubscription,
    razorpayWebhookEvent: tx.razorpayWebhookEvent,
    // Mirror Prisma: a failed callback discards webhook rows written inside it.
    $transaction: async (callback) => {
      const snapshot = { rows: rows.map((r) => ({ ...r })), payments: new Map([...payments].map(([k, v]) => [k, { ...v }])), events: new Map([...webhookEvents].map(([k, v]) => [k, { ...v }])) };
      try {
        return await callback(tx);
      } catch (error) {
        rows.forEach((row, index) => Object.assign(row, snapshot.rows[index]));
        payments.clear(); snapshot.payments.forEach((v, k) => payments.set(k, v));
        webhookEvents.clear(); snapshot.events.forEach((v, k) => webhookEvents.set(k, v));
        throw error;
      }
    },
  };
  return {
    service: new SubscriptionsService(prisma, provider),
    provider,
    row: rows[0],
    otherRow: rows[1],
    payments,
    webhookEvents,
    locks,
    state,
    owner: { id: 'owner-id', tenantId: 'tenant-id', roles: ['BUSINESS_OWNER'] },
  };
}

const sign = (body, secret = 'test-webhook-secret') => createHmac('sha256', secret).update(body).digest('hex');
const checkoutSignature = (paymentId, subscriptionId) => createHmac('sha256', 'test-key-secret').update(`${paymentId}|${subscriptionId}`).digest('hex');

async function send(state, event, payload, eventId) {
  const body = Buffer.from(JSON.stringify({ entity: 'event', event, payload }));
  return state.service.processWebhook(body, sign(body), eventId);
}
const subscriptionPayload = (overrides = {}) => ({
  subscription: { entity: { id: 'sub_test123', plan_id: 'plan_StarterMonthly', status: 'active', ...overrides } },
});
const paymentEntity = (overrides = {}) => ({
  id: 'pay_test123', invoice_id: 'inv_test123', order_id: 'order_test123', amount: 99_900, currency: 'INR', status: 'captured', created_at: NOW, ...overrides,
});
const activeRemote = (state) => {
  state.provider.remote = { ...state.provider.remote, status: 'active', current_start: NOW, current_end: NOW + 30 * DAY };
};

// ---------------------------------------------------------------- checkout --

test('checkout creates one Razorpay subscription for the saved plan and reuses it on repeat', async () => {
  const state = fixture({ razorpaySubscriptionId: null });
  const first = await state.service.createCheckout(state.owner);
  const second = await state.service.createCheckout(state.owner);
  assert.equal(state.provider.created.length, 1);
  assert.equal(first.amountPaise, 99_900);
  assert.equal(first.keyId, 'rzp_test_public');
  assert.equal(first.reused, false);
  assert.equal(second.reused, true);
  assert.equal(second.razorpaySubscriptionId, first.razorpaySubscriptionId);
  assert.equal(state.row.status, 'PENDING_ACTIVATION');
  assert.match(state.locks[0][0], /pg_advisory_xact_lock/);
});

test('repeated simultaneous taps never create duplicate Razorpay subscriptions', async () => {
  const state = fixture({ razorpaySubscriptionId: null });
  const results = await Promise.all(Array.from({ length: 6 }, () => state.service.createCheckout(state.owner)));
  assert.equal(state.provider.created.length, 1);
  assert.equal(new Set(results.map((r) => r.razorpaySubscriptionId)).size, 1);
});

test('checkout reuses a created subscription and backfills a missing checkout URL', async () => {
  const state = fixture({ providerCheckoutUrl: null });
  const result = await state.service.createCheckout(state.owner);
  assert.equal(state.provider.created.length, 0);
  assert.equal(result.checkoutUrl, 'https://rzp.io/i/test');
  assert.equal(state.row.providerCheckoutUrl, 'https://rzp.io/i/test');
});

test('checkout replaces an unrecoverable (cancelled/expired/halted/missing) provider subscription', async () => {
  for (const status of ['cancelled', 'expired', 'completed', 'halted']) {
    const state = fixture();
    state.provider.remote.status = status;
    const result = await state.service.createCheckout(state.owner);
    assert.equal(state.provider.created.length, 1, status);
    assert.notEqual(result.razorpaySubscriptionId, 'sub_test123');
    assert.equal(state.row.razorpaySubscriptionId, result.razorpaySubscriptionId);
    assert.equal(state.row.currentPeriodEnd, null);
  }
  const missing = fixture({ razorpaySubscriptionId: 'sub_gone404' });
  const result = await missing.service.createCheckout(missing.owner);
  assert.equal(missing.provider.created.length, 1);
  assert.notEqual(result.razorpaySubscriptionId, 'sub_gone404');
});

test('an uncertain Razorpay lookup never leads to a second subscription', async () => {
  const state = fixture();
  state.provider.getSubscriptionError = new ServiceUnavailableException('timeout');
  await assert.rejects(state.service.createCheckout(state.owner), /timeout/);
  assert.equal(state.provider.created.length, 0);
});

test('a Razorpay subscription that cannot be saved is cancelled instead of orphaned', async () => {
  const state = fixture({ razorpaySubscriptionId: null });
  state.state.failNextUpdate = true;
  await assert.rejects(state.service.createCheckout(state.owner), /database write failed/);
  assert.deepEqual(state.provider.cancelled, ['sub_new1']);
});

test('checkout is refused for active subscriptions and allowed for recovery states', async () => {
  const active = fixture({ status: 'ACTIVE' });
  await assert.rejects(active.service.createCheckout(active.owner), /already active/);
  for (const status of ['PENDING_ACTIVATION', 'PAST_DUE', 'EXPIRED', 'CANCELLED']) {
    const state = fixture({ status });
    state.provider.remote.status = 'cancelled';
    await state.service.createCheckout(state.owner);
    assert.equal(state.provider.created.length, 1, status);
  }
});

test('a saved plan that is not in the catalog is rejected and no provider call is made', async () => {
  const state = fixture({ planId: 'enterprise' });
  await assert.rejects(state.service.createCheckout(state.owner), /saved subscription plan is invalid/);
  assert.equal(state.provider.created.length, 0);
});

test('only the business owner can manage billing', async () => {
  const state = fixture();
  assert.throws(() => state.service.assertOwner({ id: 'x', tenantId: 'tenant-id', roles: ['BUSINESS_ADMIN'] }), /Only the business owner/);
  assert.throws(() => state.service.assertOwner({ id: 'x', tenantId: 'tenant-id', roles: ['EMPLOYEE'] }), /Only the business owner/);
});

test('billing endpoints are rate limited per tenant', async () => {
  const state = fixture();
  state.service.assertRate = SubscriptionsService.prototype.assertRate;
  let tooMany;
  for (let i = 0; i < 40 && !tooMany; i++) {
    try { await state.service.createCheckout(state.owner); } catch (error) { tooMany = error; }
  }
  assert.equal(tooMany?.getStatus?.(), 429);
});

// ----------------------------------------------------------------- verify ---

test('verification activates only after a valid signature AND a provider-confirmed captured payment', async () => {
  const state = fixture();
  activeRemote(state);
  const result = await state.service.verifyCheckout(state.owner, {
    razorpayPaymentId: 'pay_test123',
    razorpaySubscriptionId: 'sub_test123',
    razorpaySignature: checkoutSignature('pay_test123', 'sub_test123'),
  });
  assert.equal(result.activated, true);
  assert.equal(state.row.status, 'ACTIVE');
  assert.ok(state.row.activatedAt instanceof Date);
  assert.equal(state.row.currentPeriodEnd.getTime(), (NOW + 30 * DAY) * 1000);
  assert.equal(state.payments.get('pay_test123').status, 'CAPTURED');
});

test('verification does not activate when the payment is only authorized or the subscription is not active', async () => {
  const authorized = fixture();
  activeRemote(authorized);
  authorized.provider.payments.pay_test123.status = 'authorized';
  const a = await authorized.service.verifyCheckout(authorized.owner, { razorpayPaymentId: 'pay_test123', razorpaySubscriptionId: 'sub_test123', razorpaySignature: checkoutSignature('pay_test123', 'sub_test123') });
  assert.equal(a.activated, false);
  assert.equal(authorized.row.status, 'PENDING_ACTIVATION');

  const authenticated = fixture();
  authenticated.provider.remote.status = 'authenticated';
  const b = await authenticated.service.verifyCheckout(authenticated.owner, { razorpayPaymentId: 'pay_test123', razorpaySubscriptionId: 'sub_test123', razorpaySignature: checkoutSignature('pay_test123', 'sub_test123') });
  assert.equal(b.activated, false);
  assert.equal(authenticated.row.status, 'PENDING_ACTIVATION');
  assert.equal(authenticated.row.providerStatus, 'authenticated');
});

test('verification rejects wrong amount, wrong currency and a forged/invalid signature', async () => {
  const wrongAmount = fixture();
  activeRemote(wrongAmount);
  wrongAmount.provider.payments.pay_test123.amount = 100;
  const a = await wrongAmount.service.verifyCheckout(wrongAmount.owner, { razorpayPaymentId: 'pay_test123', razorpaySubscriptionId: 'sub_test123', razorpaySignature: checkoutSignature('pay_test123', 'sub_test123') });
  assert.equal(a.activated, false);

  const wrongCurrency = fixture();
  activeRemote(wrongCurrency);
  wrongCurrency.provider.payments.pay_test123.currency = 'USD';
  const b = await wrongCurrency.service.verifyCheckout(wrongCurrency.owner, { razorpayPaymentId: 'pay_test123', razorpaySubscriptionId: 'sub_test123', razorpaySignature: checkoutSignature('pay_test123', 'sub_test123') });
  assert.equal(b.activated, false);

  const forged = fixture();
  activeRemote(forged);
  await assert.rejects(forged.service.verifyCheckout(forged.owner, { razorpayPaymentId: 'pay_test123', razorpaySubscriptionId: 'sub_test123', razorpaySignature: 'a'.repeat(64) }), /signature is invalid/);
  await assert.rejects(forged.service.verifyCheckout(forged.owner, { razorpayPaymentId: 'pay_test123', razorpaySubscriptionId: 'sub_test123', razorpaySignature: checkoutSignature('pay_test123', 'sub_other999') }), /signature is invalid/);
  assert.equal(forged.row.status, 'PENDING_ACTIVATION');
  assert.equal(forged.payments.size, 0);
});

test('verification cannot touch another tenant subscription', async () => {
  const state = fixture();
  activeRemote(state);
  await assert.rejects(
    state.service.verifyCheckout(state.owner, { razorpayPaymentId: 'pay_test123', razorpaySubscriptionId: 'sub_other999', razorpaySignature: checkoutSignature('pay_test123', 'sub_other999') }),
    /does not belong/,
  );
  assert.equal(state.otherRow.status, 'PENDING_ACTIVATION');
  const strangerWithoutRow = { id: 'x', tenantId: 'no-such-tenant', roles: ['BUSINESS_OWNER'] };
  await assert.rejects(state.service.verifyCheckout(strangerWithoutRow, { razorpayPaymentId: 'pay_test123', razorpaySubscriptionId: 'sub_test123', razorpaySignature: checkoutSignature('pay_test123', 'sub_test123') }), /does not belong/);
});

test('verification rejects a payment whose invoice belongs to a different subscription', async () => {
  const state = fixture();
  activeRemote(state);
  state.provider.invoices.inv_test123.subscription_id = 'sub_someoneelse';
  await assert.rejects(
    state.service.verifyCheckout(state.owner, { razorpayPaymentId: 'pay_test123', razorpaySubscriptionId: 'sub_test123', razorpaySignature: checkoutSignature('pay_test123', 'sub_test123') }),
    /different subscription/,
  );
  assert.equal(state.row.status, 'PENDING_ACTIVATION');
});

test('verification rejects malformed identifiers before any provider call', async () => {
  const state = fixture();
  await assert.rejects(state.service.verifyCheckout(state.owner, { razorpayPaymentId: 'bad', razorpaySubscriptionId: 'sub_test123', razorpaySignature: 'a'.repeat(64) }), /Invalid Razorpay checkout response/);
});

test('refresh activates from provider invoices without any webhook and ignores unpaid invoices', async () => {
  const state = fixture();
  activeRemote(state);
  state.provider.invoices.inv_unpaid = { id: 'inv_unpaid', subscription_id: 'sub_test123', payment_id: 'pay_unpaid', status: 'issued', amount: 99_900, currency: 'INR' };
  const result = await state.service.refresh(state.owner);
  assert.equal(result.status, 'ACTIVE');
  assert.equal(state.payments.has('pay_unpaid'), false);
});

test('refresh with only an authenticated mandate (no charge) stays pending', async () => {
  const state = fixture();
  state.provider.remote.status = 'authenticated';
  state.provider.invoices = {};
  const result = await state.service.refresh(state.owner);
  assert.equal(result.status, 'PENDING_ACTIVATION');
  assert.equal(result.providerStatus, 'authenticated');
});

// --------------------------------------------------------------- webhooks ---

test('webhook rejects a bad signature, a missing signature and a modified body without storing anything', async () => {
  const state = fixture();
  const body = Buffer.from('{"event":"subscription.activated"}');
  await assert.rejects(state.service.processWebhook(Buffer.from(`${body.toString()} `), sign(body), 'evt_raw1'), /signature is invalid/);
  await assert.rejects(state.service.processWebhook(body, 'z'.repeat(64), 'evt_raw2'), /signature is invalid/);
  await assert.rejects(state.service.processWebhook(body, sign(body, 'wrong-secret'), 'evt_raw3'), /signature is invalid/);
  await assert.rejects(state.service.processWebhook(body, undefined, 'evt_raw4'), /required/);
  await assert.rejects(state.service.processWebhook(undefined, sign(body), 'evt_raw5'), /required/);
  assert.equal(state.webhookEvents.size, 0);
  assert.equal(state.row.status, 'PENDING_ACTIVATION');
});

test('webhook fails closed when no signing secret is configured', async () => {
  const state = fixture();
  const previous = process.env.RAZORPAY_WEBHOOK_SECRET;
  delete process.env.RAZORPAY_WEBHOOK_SECRET;
  try {
    const body = Buffer.from('{"event":"subscription.activated"}');
    await assert.rejects(state.service.processWebhook(body, sign(body), 'evt_nosecret'), /not configured/);
  } finally {
    process.env.RAZORPAY_WEBHOOK_SECRET = previous;
  }
});

test('subscription.charged (real payload shape) activates once; duplicates are acknowledged without reprocessing', async () => {
  const state = fixture();
  activeRemote(state);
  const payload = { ...subscriptionPayload(), payment: { entity: paymentEntity() } };
  const first = await send(state, 'subscription.charged', payload, 'evt_charged1');
  const duplicate = await send(state, 'subscription.charged', payload, 'evt_charged1');
  assert.deepEqual(first, { received: true, duplicate: false });
  assert.deepEqual(duplicate, { received: true, duplicate: true });
  assert.equal(state.row.status, 'ACTIVE');
  assert.equal(state.webhookEvents.size, 1);
  assert.ok(state.webhookEvents.get('evt_charged1').processedAt instanceof Date);
});

test('a replayed signed body under a different event ID cannot regress or duplicate state', async () => {
  const state = fixture();
  activeRemote(state);
  const payload = { ...subscriptionPayload(), payment: { entity: paymentEntity() } };
  await send(state, 'subscription.charged', payload, 'evt_a');
  // Provider later reports a failed renewal.
  state.provider.remote.status = 'halted';
  await send(state, 'subscription.halted', subscriptionPayload({ status: 'halted' }), 'evt_halted');
  assert.equal(state.row.status, 'PAST_DUE');
  // Attacker replays the old, validly signed "charged" body under a new event ID.
  await send(state, 'subscription.charged', payload, 'evt_replay');
  assert.equal(state.row.status, 'PAST_DUE');
  assert.equal(state.payments.size, 1);
});

test('events without an event-id header are deduplicated by a digest of the signed body', async () => {
  const state = fixture();
  activeRemote(state);
  const body = Buffer.from(JSON.stringify({ event: 'subscription.activated', payload: subscriptionPayload() }));
  const first = await state.service.processWebhook(body, sign(body), undefined);
  const second = await state.service.processWebhook(body, sign(body), undefined);
  assert.equal(first.duplicate, false);
  assert.equal(second.duplicate, true);
});

test('subscription.activated before the payment is recorded does not grant access; payment.captured then does', async () => {
  const state = fixture();
  activeRemote(state);
  await send(state, 'subscription.activated', subscriptionPayload(), 'evt_act');
  assert.equal(state.row.status, 'PENDING_ACTIVATION');
  assert.equal(state.row.providerStatus, 'active');
  // payment.captured carries only the payment: it is tied to our subscription through its invoice.
  await send(state, 'payment.captured', { payment: { entity: paymentEntity() } }, 'evt_cap');
  assert.equal(state.row.status, 'ACTIVE');
});

test('subscription.authenticated alone never activates paid access', async () => {
  const state = fixture();
  state.provider.remote.status = 'authenticated';
  await send(state, 'subscription.authenticated', subscriptionPayload({ status: 'authenticated' }), 'evt_auth');
  assert.equal(state.row.status, 'PENDING_ACTIVATION');
  assert.equal(state.row.providerStatus, 'authenticated');
});

test('a payment of the wrong amount or currency never activates', async () => {
  for (const bad of [{ amount: 100 }, { currency: 'USD' }, { status: 'authorized' }]) {
    const state = fixture();
    activeRemote(state);
    await send(state, 'subscription.charged', { ...subscriptionPayload(), payment: { entity: paymentEntity(bad) } }, 'evt_bad');
    assert.equal(state.row.status, 'PENDING_ACTIVATION', JSON.stringify(bad));
  }
});

test('stale events cannot reverse a newer provider state (out-of-order delivery)', async () => {
  // Provider is currently ACTIVE and paid, but a stale "pending" event arrives late.
  const state = fixture();
  activeRemote(state);
  await send(state, 'subscription.charged', { ...subscriptionPayload(), payment: { entity: paymentEntity() } }, 'evt_1');
  assert.equal(state.row.status, 'ACTIVE');
  await send(state, 'subscription.pending', subscriptionPayload({ status: 'pending' }), 'evt_stale_pending');
  assert.equal(state.row.status, 'ACTIVE');

  // Provider is currently HALTED, but a stale "activated" event arrives late.
  state.provider.remote.status = 'halted';
  await send(state, 'subscription.halted', subscriptionPayload({ status: 'halted' }), 'evt_halt');
  assert.equal(state.row.status, 'PAST_DUE');
  await send(state, 'subscription.activated', subscriptionPayload({ status: 'active' }), 'evt_stale_activated');
  assert.equal(state.row.status, 'PAST_DUE');
});

test('renewal keeps access and extends the period; a failed renewal moves to PAST_DUE and recovers on the next charge', async () => {
  const state = fixture();
  activeRemote(state);
  await send(state, 'subscription.charged', { ...subscriptionPayload(), payment: { entity: paymentEntity() } }, 'evt_c1');
  const firstEnd = state.row.currentPeriodEnd.getTime();

  // Month 2 renewal.
  state.provider.payments.pay_renewal = paymentEntity({ id: 'pay_renewal', invoice_id: 'inv_2' });
  state.provider.invoices.inv_2 = { id: 'inv_2', subscription_id: 'sub_test123', payment_id: 'pay_renewal', status: 'paid', amount: 99_900, currency: 'INR' };
  state.provider.remote = { ...state.provider.remote, current_start: NOW + 30 * DAY, current_end: NOW + 60 * DAY };
  await send(state, 'subscription.charged', { ...subscriptionPayload(), payment: { entity: paymentEntity({ id: 'pay_renewal', invoice_id: 'inv_2' }) } }, 'evt_c2');
  assert.equal(state.row.status, 'ACTIVE');
  assert.ok(state.row.currentPeriodEnd.getTime() > firstEnd);
  assert.equal(state.payments.size, 2);

  // Month 3 charge fails.
  state.provider.remote.status = 'pending';
  await send(state, 'subscription.pending', subscriptionPayload({ status: 'pending' }), 'evt_p');
  assert.equal(state.row.status, 'PAST_DUE');

  // Customer updates the card and Razorpay charges successfully.
  state.provider.payments.pay_recover = paymentEntity({ id: 'pay_recover', invoice_id: 'inv_3' });
  state.provider.invoices.inv_3 = { id: 'inv_3', subscription_id: 'sub_test123', payment_id: 'pay_recover', status: 'paid', amount: 99_900, currency: 'INR' };
  state.provider.remote = { ...state.provider.remote, status: 'active', current_end: NOW + 90 * DAY };
  await send(state, 'subscription.charged', { ...subscriptionPayload(), payment: { entity: paymentEntity({ id: 'pay_recover', invoice_id: 'inv_3' }) } }, 'evt_c3');
  assert.equal(state.row.status, 'ACTIVE');
});

test('payment.failed before first activation leaves the tenant awaiting payment and records the failure', async () => {
  const state = fixture();
  state.provider.remote.status = 'created';
  await send(state, 'payment.failed', { payment: { entity: paymentEntity({ id: 'pay_failed1', invoice_id: 'inv_test123', status: 'failed', error_code: 'BAD_REQUEST_ERROR', error_description: 'Card declined' }) } }, 'evt_fail');
  assert.equal(state.row.status, 'PENDING_ACTIVATION');
  assert.equal(state.payments.get('pay_failed1').status, 'FAILED');
  assert.equal(state.payments.get('pay_failed1').failureCode, 'BAD_REQUEST_ERROR');
});

test('a late failure event never downgrades an already captured payment', async () => {
  const state = fixture();
  activeRemote(state);
  await send(state, 'subscription.charged', { ...subscriptionPayload(), payment: { entity: paymentEntity() } }, 'evt_ok');
  await send(state, 'payment.failed', { payment: { entity: paymentEntity({ status: 'failed' }) } }, 'evt_late_fail');
  assert.equal(state.payments.get('pay_test123').status, 'CAPTURED');
  assert.equal(state.row.status, 'ACTIVE');
});

test('halted, paused, cancelled (immediate and at cycle end), completed and expired transitions', async () => {
  const activated = () => { const s = fixture({ status: 'ACTIVE', activatedAt: new Date() }); return s; };

  const halted = activated();
  halted.provider.remote.status = 'halted';
  await send(halted, 'subscription.halted', subscriptionPayload({ status: 'halted' }), 'e1');
  assert.equal(halted.row.status, 'PAST_DUE');

  const paused = activated();
  paused.provider.remote.status = 'paused';
  await send(paused, 'subscription.paused', subscriptionPayload({ status: 'paused' }), 'e2');
  assert.equal(paused.row.status, 'PAST_DUE');

  const cancelledNow = activated();
  cancelledNow.provider.remote = { ...cancelledNow.provider.remote, status: 'cancelled', ended_at: NOW, current_end: NOW - 10, cancel_at_cycle_end: false };
  await send(cancelledNow, 'subscription.cancelled', subscriptionPayload({ status: 'cancelled' }), 'e3');
  assert.equal(cancelledNow.row.status, 'CANCELLED');

  const cancelledAtEnd = activated();
  const end = NOW + 3600;
  cancelledAtEnd.provider.remote = { ...cancelledAtEnd.provider.remote, status: 'cancelled', current_end: end, ended_at: NOW, cancel_at_cycle_end: true };
  await send(cancelledAtEnd, 'subscription.cancelled', subscriptionPayload({ status: 'cancelled' }), 'e4');
  assert.equal(cancelledAtEnd.row.status, 'ACTIVE');
  assert.equal(cancelledAtEnd.row.expiresAt.getTime(), end * 1000);
  assert.equal(cancelledAtEnd.row.cancelAtPeriodEnd, true);

  const completed = activated();
  completed.provider.remote = { ...completed.provider.remote, status: 'completed', ended_at: NOW, current_end: NOW };
  await send(completed, 'subscription.completed', subscriptionPayload({ status: 'completed' }), 'e5');
  assert.equal(completed.row.status, 'EXPIRED');
});

test('a never-paid checkout that is cancelled or expires stays awaiting payment so it can be recreated', async () => {
  for (const status of ['cancelled', 'expired']) {
    const state = fixture();
    state.provider.remote.status = status;
    await send(state, status === 'cancelled' ? 'subscription.cancelled' : 'subscription.expired', subscriptionPayload({ status }), `evt_${status}`);
    assert.equal(state.row.status, 'PENDING_ACTIVATION');
    await state.service.createCheckout(state.owner);
    assert.equal(state.provider.created.length, 1);
  }
});

test('events for a replaced or unknown subscription, or an unexpected plan, never change this tenant', async () => {
  const state = fixture({ razorpaySubscriptionId: 'sub_current' });
  state.provider.remote = { ...state.provider.remote, id: 'sub_current', status: 'active', current_end: NOW + DAY };
  // Old (replaced) subscription id: no local row points at it.
  const old = await send(state, 'subscription.activated', subscriptionPayload({ id: 'sub_replaced_old' }), 'evt_old');
  assert.deepEqual(old, { received: true, duplicate: false });
  assert.equal(state.row.status, 'PENDING_ACTIVATION');
  // Unexpected plan on the current subscription.
  state.provider.remote.plan_id = 'plan_Hijacked';
  await send(state, 'subscription.charged', { ...subscriptionPayload({ id: 'sub_current', plan_id: 'plan_Hijacked' }), payment: { entity: paymentEntity() } }, 'evt_plan');
  assert.equal(state.row.status, 'PENDING_ACTIVATION');
});

test('unrelated and unknown events are acknowledged without changing access', async () => {
  const state = fixture();
  activeRemote(state);
  // A one-time (non-subscription) payment: no invoice, no subscription.
  const unrelated = await send(state, 'payment.captured', { payment: { entity: { id: 'pay_other', amount: 99_900, currency: 'INR', status: 'captured', order_id: 'order_x' } } }, 'evt_unrelated');
  assert.equal(unrelated.received, true);
  assert.equal(state.row.status, 'PENDING_ACTIVATION');
  assert.equal(state.payments.size, 0);
  const unknown = await send(state, 'order.paid', { order: { entity: { id: 'order_1' } } }, 'evt_unknown');
  assert.equal(unknown.received, true);
  assert.equal(state.row.status, 'PENDING_ACTIVATION');
});

test('a provider outage while processing a webhook is not acknowledged, so Razorpay retries', async () => {
  const state = fixture();
  state.provider.getSubscriptionError = new ServiceUnavailableException('Razorpay down');
  await assert.rejects(send(state, 'subscription.activated', subscriptionPayload(), 'evt_outage'), /Razorpay down/);
  assert.equal(state.webhookEvents.size, 0);
  // Same event is processed normally when Razorpay recovers.
  state.provider.getSubscriptionError = null;
  activeRemote(state);
  await send(state, 'subscription.activated', subscriptionPayload(), 'evt_outage');
  assert.equal(state.webhookEvents.get('evt_outage').processedAt instanceof Date, true);
});

// ------------------------------------------------------------ HTTP provider --

function withEnv(values) {
  const previous = {};
  for (const [key, value] of Object.entries(values)) {
    previous[key] = process.env[key];
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  return () => { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } };
}

test('HTTP provider creates correct subscriptions for all six plan/cycle combinations', async () => {
  const restore = withEnv({ RAZORPAY_KEY_ID: 'rzp_test_public', RAZORPAY_KEY_SECRET: 'test-key-secret' });
  const originalFetch = global.fetch;
  const prices = { starter: [99_900, 999_000], growth: [249_900, 2_499_000], scale: [599_900, 5_999_000] };
  try {
    for (const [planId, [monthly, annual]] of Object.entries(prices)) {
      for (const [cycle, amount] of [['monthly', monthly], ['annual', annual]]) {
        const calls = [];
        const planKey = `plan_${planId[0].toUpperCase()}${planId.slice(1)}${cycle === 'monthly' ? 'Monthly' : 'Annual'}`;
        global.fetch = async (url, options) => {
          calls.push({ url: String(url), options });
          if (String(url).includes('/v1/plans/')) return { ok: true, json: async () => ({ id: planKey, period: cycle === 'monthly' ? 'monthly' : 'yearly', interval: 1, item: { amount, currency: 'INR' } }) };
          return { ok: true, json: async () => ({ id: 'sub_x1', plan_id: planKey, status: 'created' }) };
        };
        const result = await new RazorpayHttpProvider().createSubscription({ planId, billingCycle: cycle, tenantId: 'tenant-id' });
        assert.equal(result.id, 'sub_x1');
        assert.ok(calls[0].url.endsWith(`/v1/plans/${planKey}`), `${planId} ${cycle}`);
        const body = JSON.parse(calls[1].options.body);
        assert.equal(body.plan_id, planKey);
        assert.equal(body.total_count, cycle === 'monthly' ? 120 : 10);
        assert.equal(body.quantity, 1);
        assert.equal(body.customer_notify, true);
        assert.equal(body.notes.tenant_id, 'tenant-id');
        assert.equal(calls[1].options.headers.Authorization.startsWith('Basic '), true);
      }
    }
  } finally {
    global.fetch = originalFetch;
    restore();
  }
});

test('HTTP provider refuses a plan with the wrong amount, period or interval', async () => {
  const restore = withEnv({ RAZORPAY_KEY_ID: 'rzp_test_public', RAZORPAY_KEY_SECRET: 'test-key-secret' });
  const originalFetch = global.fetch;
  try {
    for (const remote of [{ item: { amount: 1, currency: 'INR' } }, { period: 'yearly' }, { interval: 2 }, { item: { amount: 99_900, currency: 'USD' } }]) {
      global.fetch = async () => ({ ok: true, json: async () => ({ id: 'plan_StarterMonthly', period: 'monthly', interval: 1, item: { amount: 99_900, currency: 'INR' }, ...remote }) });
      await assert.rejects(new RazorpayHttpProvider().createSubscription({ planId: 'starter', billingCycle: 'monthly', tenantId: 't' }), /does not match the selected price/);
    }
  } finally {
    global.fetch = originalFetch;
    restore();
  }
});

test('HTTP provider maps Razorpay errors without leaking credentials and treats 404 as not-found', async () => {
  const restore = withEnv({ RAZORPAY_KEY_ID: 'rzp_test_public', RAZORPAY_KEY_SECRET: 'test-key-secret' });
  const originalFetch = global.fetch;
  try {
    global.fetch = async () => ({ ok: false, status: 400, json: async () => ({ error: { code: 'BAD_REQUEST_ERROR', description: 'bad', reason: 'x' } }) });
    await assert.rejects(new RazorpayHttpProvider().getSubscription('sub_a'), (error) => { assert.equal(error.getStatus(), 502); assert.doesNotMatch(error.message, /test-key-secret/); return true; });
    global.fetch = async () => ({ ok: false, status: 404, json: async () => ({}) });
    await assert.rejects(new RazorpayHttpProvider().getSubscription('sub_a'), (error) => error instanceof NotFoundException);
    global.fetch = async () => ({ ok: false, status: 500, json: async () => { throw new Error('not json'); } });
    await assert.rejects(new RazorpayHttpProvider().getSubscription('sub_a'), (error) => error.getStatus() === 503);
    global.fetch = async () => { throw new Error('network'); };
    await assert.rejects(new RazorpayHttpProvider().getSubscription('sub_a'), /Unable to reach Razorpay/);
  } finally {
    global.fetch = originalFetch;
    restore();
  }
});

test('live Razorpay keys are refused outside production and wherever test mode is enforced', () => {
  const restore = withEnv({ NODE_ENV: 'development', RAZORPAY_ENFORCE_TEST_MODE: undefined });
  try {
    assert.throws(() => assertRazorpayKeyModeAllowed('rzp_live_abc'), /live keys are not permitted/);
    assert.doesNotThrow(() => assertRazorpayKeyModeAllowed('rzp_test_abc'));
    assert.throws(() => assertRazorpayKeyModeAllowed('garbage'), /not a valid Razorpay key/);
    process.env.NODE_ENV = 'production';
    assert.doesNotThrow(() => assertRazorpayKeyModeAllowed('rzp_live_abc'));
    process.env.RAZORPAY_ENFORCE_TEST_MODE = 'true';
    assert.throws(() => assertRazorpayKeyModeAllowed('rzp_live_abc'), /live keys are not permitted/);
  } finally {
    restore();
  }
});

test('missing or malformed plan configuration fails closed', () => {
  const restore = withEnv({ RAZORPAY_PLAN_STARTER_MONTHLY: undefined });
  try {
    const { configuredRazorpayPlanId } = require('../src/modules/subscriptions/razorpay.provider');
    assert.throws(() => configuredRazorpayPlanId('starter', 'monthly'), /missing or invalid/);
    process.env.RAZORPAY_PLAN_STARTER_MONTHLY = 'not-a-plan';
    assert.throws(() => configuredRazorpayPlanId('starter', 'monthly'), /missing or invalid/);
  } finally {
    restore();
  }
});
