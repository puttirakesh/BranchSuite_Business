// MOCKED tests for prepaid (Razorpay Orders) billing: an in-memory Prisma double and
// a fake Razorpay provider. They prove OUR logic, not real Razorpay behaviour.
require('reflect-metadata');
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const { test } = require('node:test');
const { Prisma } = require('@prisma/client');
const { ValidationPipe, NotFoundException, ServiceUnavailableException } = require('@nestjs/common');
const { SubscriptionsService } = require('../src/modules/subscriptions/subscriptions.service');
const { CreateOrderDto } = require('../src/modules/subscriptions/dto/create-order.dto');
const { VerifyPaymentDto } = require('../src/modules/subscriptions/dto/verify-payment.dto');
const { RazorpayHttpProvider, assertRazorpayKeyModeAllowed } = require('../src/modules/subscriptions/razorpay.provider');
const { evaluateSubscriptionAccess } = require('../src/common/subscription-access');

Object.assign(process.env, {
  RAZORPAY_KEY_SECRET: 'test-key-secret',
  RAZORPAY_WEBHOOK_SECRET: 'test-webhook-secret',
  JWT_SECRET: 'test-jwt-secret',
});

const NOW = Math.floor(Date.now() / 1000);
const DAY = 86_400_000;
const BASE = 'https://api.example.test/api/v1';
const PRICES = { starter: [99_900, 999_000], growth: [249_900, 2_499_000], scale: [599_900, 5_999_000] };

const baseRow = (overrides = {}) => ({
  id: 'sub-row-1', tenantId: 'tenant-id', planId: 'starter', billingCycle: 'monthly', status: 'PENDING_ACTIVATION',
  billingModel: 'PREPAID', razorpaySubscriptionId: null, providerStatus: null, providerCheckoutUrl: null,
  activatedAt: null, currentPeriodStart: null, currentPeriodEnd: null, cancelAtPeriodEnd: false,
  cancelledAt: null, expiresAt: null, lastPaymentAt: null, ...overrides,
});

class FakeRazorpay {
  constructor() {
    this.orders = new Map();
    this.payments = new Map();
    this.created = [];
    this.captures = [];
    this.seq = 1;
    this.getOrderError = null;
    this.captureError = null;
    this.listError = null;
  }
  async createOrder(input) {
    const id = `order_T${this.seq++}`;
    this.created.push({ ...input, id });
    this.orders.set(id, { id, amount: input.amountPaise, currency: input.currency, receipt: input.receipt, status: 'created', notes: input.notes });
    return { ...this.orders.get(id) };
  }
  async getOrder(id) {
    if (this.getOrderError) throw this.getOrderError;
    if (!this.orders.has(id)) throw new NotFoundException('missing');
    return { ...this.orders.get(id) };
  }
  async listOrderPayments(orderId) {
    if (this.listError) throw this.listError;
    return [...this.payments.values()].filter((p) => p.order_id === orderId).map((p) => ({ ...p }));
  }
  async getPayment(id) {
    if (!this.payments.has(id)) throw new NotFoundException('missing');
    return { ...this.payments.get(id) };
  }
  async capturePayment(id, amount, currency) {
    this.captures.push([id, amount, currency]);
    if (this.captureError) throw this.captureError;
    const p = this.payments.get(id);
    if (p.status !== 'authorized') throw new Error('not authorized');
    p.status = 'captured';
    this.orders.get(p.order_id).status = 'paid';
    return { ...p };
  }
  publicKeyId() { return 'rzp_test_public'; }
  /** Simulates the customer paying `order` (status: captured | authorized | failed). */
  pay(order, status = 'captured', overrides = {}) {
    const id = overrides.id ?? `pay_T${this.seq++}`;
    const payment = { id, order_id: order, amount: this.orders.get(order).amount, currency: 'INR', status, method: 'card', created_at: NOW, ...overrides };
    this.payments.set(id, payment);
    const rzOrder = this.orders.get(order);
    if (status === 'captured') rzOrder.status = 'paid'; else if (rzOrder.status === 'created') rzOrder.status = 'attempted';
    return payment;
  }
}

function matches(row, where) {
  return Object.entries(where).every(([key, expected]) => {
    if (expected && typeof expected === 'object' && !(expected instanceof Date)) {
      if ('not' in expected) return row[key] !== expected.not;
      if ('in' in expected) return expected.in.includes(row[key]);
    }
    return row[key] === expected;
  });
}

function fixture(rowOverrides = {}) {
  const subs = [baseRow(rowOverrides), baseRow({ id: 'sub-row-2', tenantId: 'other-tenant' })];
  const orders = [];
  const payments = new Map();
  const events = new Map();
  const provider = new FakeRazorpay();
  const locks = [];
  const state = { failOrderCreate: false, tick: 0 };
  const findSub = (where) => subs.find((s) => matches(s, where));
  const tx = {
    $executeRaw: async (strings, ...values) => { locks.push(values[0]); return 1; },
    businessSubscription: {
      findUnique: async ({ where, include }) => {
        const row = findSub(where);
        if (!row) return null;
        const copy = { ...row };
        if (include?.payments) copy.payments = [...payments.values()].filter((p) => p.subscriptionId === row.id).sort((a, b) => b.createdAt - a.createdAt);
        if (include?.orders) copy.orders = orders.filter((o) => o.subscriptionId === row.id && matches(o, include.orders.where ?? {})).sort((a, b) => b.createdAt - a.createdAt).slice(0, include.orders.take ?? 99);
        return copy;
      },
      update: async ({ where, data }) => ({ ...Object.assign(findSub(where), data) }),
      updateMany: async ({ where, data }) => {
        const row = subs.find((s) => s.tenantId === where.tenantId && s.status === where.status);
        if (!row) return { count: 0 };
        const ended = (row.expiresAt && row.expiresAt <= new Date()) || (row.currentPeriodEnd && row.currentPeriodEnd <= new Date());
        if (!ended) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      },
    },
    subscriptionOrder: {
      findUnique: async ({ where }) => { const o = orders.find((x) => matches(x, where)); return o ? { ...o } : null; },
      findFirst: async ({ where }) => { const o = orders.filter((x) => matches(x, where)).sort((a, b) => b.createdAt - a.createdAt)[0]; return o ? { ...o } : null; },
      findMany: async ({ where, take }) => orders.filter((x) => matches(x, where)).sort((a, b) => b.createdAt - a.createdAt).slice(0, take ?? 99).map((o) => ({ ...o })),
      create: async ({ data }) => {
        if (state.failOrderCreate) throw new Error('database write failed');
        const order = { razorpayPaymentId: null, failureCode: null, failureDescription: null, validFrom: null, validUntil: null, appliedAt: null, ...data, createdAt: new Date(Date.now() + state.tick++) };
        orders.push(order);
        return { ...order };
      },
      updateMany: async ({ where, data }) => {
        const targets = orders.filter((o) => matches(o, where));
        targets.forEach((o) => {
          if (data.razorpayPaymentId && orders.some((x) => x !== o && x.razorpayPaymentId === data.razorpayPaymentId)) {
            throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: '6.19.3' });
          }
          Object.assign(o, data);
        });
        return { count: targets.length };
      },
    },
    subscriptionPayment: {
      findUnique: async ({ where }) => payments.get(where.providerPaymentId) ?? null,
      upsert: async ({ where, create, update }) => {
        const prev = payments.get(where.providerPaymentId);
        const value = prev ? Object.assign(prev, update) : { id: `payment-${payments.size + 1}`, createdAt: new Date(Date.now() + state.tick++), ...create };
        payments.set(where.providerPaymentId, value);
        return value;
      },
    },
    razorpayWebhookEvent: {
      create: async ({ data }) => {
        if (events.has(data.providerEventId)) throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: '6.19.3' });
        events.set(data.providerEventId, { id: data.providerEventId, ...data });
        return events.get(data.providerEventId);
      },
      update: async ({ where, data }) => Object.assign(events.get(where.providerEventId), data),
      findUnique: async ({ where }) => events.get(where.providerEventId) ?? null,
    },
  };
  const prisma = {
    ...tx,
    $transaction: async (callback) => {
      const snap = { subs: subs.map((s) => ({ ...s })), orders: orders.map((o) => ({ ...o })), payments: new Map([...payments].map(([k, v]) => [k, { ...v }])), events: new Map([...events].map(([k, v]) => [k, { ...v }])) };
      try { return await callback(tx); } catch (error) {
        subs.forEach((s, i) => Object.assign(s, snap.subs[i]));
        orders.length = 0; snap.orders.forEach((o) => orders.push(o));
        payments.clear(); snap.payments.forEach((v, k) => payments.set(k, v));
        events.clear(); snap.events.forEach((v, k) => events.set(k, v));
        throw error;
      }
    },
  };
  return {
    service: new SubscriptionsService(prisma, provider), provider, row: subs[0], other: subs[1], orders, payments, events, locks, state,
    owner: { id: 'owner-id', tenantId: 'tenant-id', roles: ['BUSINESS_OWNER'] },
  };
}

const sign = (rzOrder, paymentId, secret = 'test-key-secret') => createHmac('sha256', secret).update(`${rzOrder}|${paymentId}`).digest('hex');
const webhookSign = (body, secret = 'test-webhook-secret') => createHmac('sha256', secret).update(body).digest('hex');
const verifyInput = (rzOrder, paymentId, signature) => ({ razorpayOrderId: rzOrder, razorpayPaymentId: paymentId, razorpaySignature: signature ?? sign(rzOrder, paymentId) });
async function webhook(state, event, payload, eventId) {
  const body = Buffer.from(JSON.stringify({ entity: 'event', event, payload }));
  return state.service.processWebhook(body, webhookSign(body), eventId);
}
const paymentPayload = (payment) => ({ payment: { entity: { ...payment } } });
const approxMonths = (from, months) => { const d = new Date(from); d.setUTCMonth(d.getUTCMonth() + months); return d; };

// ---------------------------------------------------------------- order creation --

test('orders use server-side amounts for all six plan/cycle combinations and the Orders API request is well formed', async () => {
  for (const [planId, [monthly, annual]] of Object.entries(PRICES)) {
    for (const [cycle, amount] of [['monthly', monthly], ['annual', annual]]) {
      const s = fixture({ planId, billingCycle: cycle });
      const order = await s.service.createOrder(s.owner, {}, BASE);
      assert.equal(order.amount, amount, `${planId} ${cycle}`);
      assert.equal(order.currency, 'INR');
      assert.equal(order.purpose, 'ACTIVATION');
      assert.equal(order.keyId, 'rzp_test_public');
      const sent = s.provider.created[0];
      assert.equal(sent.amountPaise, amount);
      assert.equal(sent.currency, 'INR');
      assert.ok(sent.receipt.length <= 40);
      assert.equal(sent.notes.tenant_id, 'tenant-id');
      assert.equal(sent.notes.plan_id, planId);
      assert.equal(sent.notes.billing_cycle, cycle);
      assert.equal(s.orders[0].razorpayOrderId, order.razorpayOrderId);
      assert.equal(s.orders[0].tenantId, 'tenant-id');
      assert.match(order.hostedCheckoutUrl, new RegExp(`^${BASE}/subscriptions/checkout-page/${order.orderId}\\?t=\\d+\\.[a-f0-9]{64}$`));
    }
  }
});

test('clients cannot choose an amount or a tenant: extra fields are stripped, bad plan/cycle rejected', async () => {
  const pipe = new ValidationPipe({ whitelist: true, transform: true });
  const out = await pipe.transform({ planId: 'scale', billingCycle: 'annual', amount: 1, amountPaise: 1, tenantId: 'someone-else' }, { type: 'body', metatype: CreateOrderDto });
  assert.deepEqual({ ...out }, { planId: 'scale', billingCycle: 'annual' });
  for (const bad of [{ planId: 'enterprise' }, { billingCycle: 'weekly' }, { planId: 'SCALE' }]) {
    await assert.rejects(pipe.transform(bad, { type: 'body', metatype: CreateOrderDto }));
  }
  await assert.rejects(pipe.transform({ razorpayOrderId: 'bad', razorpayPaymentId: 'pay_1', razorpaySignature: 'f'.repeat(64) }, { type: 'body', metatype: VerifyPaymentDto }));
});

test('before the first payment the plan can still be chosen; after a purchase a different plan is refused', async () => {
  const pending = fixture();
  const order = await pending.service.createOrder(pending.owner, { planId: 'scale', billingCycle: 'annual' }, BASE);
  assert.equal(order.amount, 5_999_000);
  assert.equal(pending.row.planId, 'scale');
  assert.equal(pending.row.billingCycle, 'annual');

  const paid = fixture({ status: 'EXPIRED', activatedAt: new Date(Date.now() - 40 * DAY), expiresAt: new Date(Date.now() - DAY), currentPeriodEnd: new Date(Date.now() - DAY) });
  await assert.rejects(paid.service.createOrder(paid.owner, { planId: 'scale' }, BASE), /Changing plan or billing cycle is not supported/);
  await assert.rejects(paid.service.createOrder(paid.owner, { billingCycle: 'annual' }, BASE), /not supported/);
  assert.equal(paid.provider.created.length, 0);
  // Re-selecting the same plan is fine.
  assert.equal((await paid.service.createOrder(paid.owner, { planId: 'starter', billingCycle: 'monthly' }, BASE)).purpose, 'RENEWAL');
});

test('an unknown stored plan is rejected before any provider call', async () => {
  const s = fixture({ planId: 'enterprise' });
  await assert.rejects(s.service.createOrder(s.owner, {}, BASE), /invalid|Invalid/);
  assert.equal(s.provider.created.length, 0);
});

test('a pending order is reused; simultaneous taps create exactly one Razorpay order', async () => {
  const s = fixture();
  const results = await Promise.all(Array.from({ length: 6 }, () => s.service.createOrder(s.owner, {}, BASE)));
  assert.equal(s.provider.created.length, 1);
  assert.equal(new Set(results.map((r) => r.razorpayOrderId)).size, 1);
  const again = await s.service.createOrder(s.owner, {}, BASE);
  assert.equal(again.reused, true);
  assert.equal(again.razorpayOrderId, results[0].razorpayOrderId);
  assert.equal(s.provider.created.length, 1);
  assert.match(s.locks[0], /^subscription-billing:tenant-id$/);
});

test('an order that is stale, different, or missing at Razorpay is replaced; an uncertain lookup never duplicates', async () => {
  const s = fixture();
  const first = await s.service.createOrder(s.owner, {}, BASE);
  s.orders[0].createdAt = new Date(Date.now() - 2 * DAY); // stale
  const second = await s.service.createOrder(s.owner, {}, BASE);
  assert.notEqual(second.razorpayOrderId, first.razorpayOrderId);
  assert.equal(s.orders.find((o) => o.razorpayOrderId === first.razorpayOrderId).status, 'CANCELLED');

  const uncertain = fixture();
  await uncertain.service.createOrder(uncertain.owner, {}, BASE);
  uncertain.provider.getOrderError = new ServiceUnavailableException('timeout');
  await assert.rejects(uncertain.service.createOrder(uncertain.owner, {}, BASE), /timeout/);
  assert.equal(uncertain.provider.created.length, 1);
});

test('a failed database write leaves no usable order and the next attempt succeeds', async () => {
  const s = fixture();
  s.state.failOrderCreate = true;
  await assert.rejects(s.service.createOrder(s.owner, {}, BASE), /database write failed/);
  assert.equal(s.orders.length, 0);
  s.state.failOrderCreate = false;
  const order = await s.service.createOrder(s.owner, {}, BASE);
  assert.equal(order.reused, false);
});

test('only the business owner may create orders or verify payments', () => {
  const s = fixture();
  for (const role of ['BUSINESS_ADMIN', 'HR_MANAGER', 'EMPLOYEE']) {
    assert.throws(() => s.service.assertOwner({ id: 'x', tenantId: 'tenant-id', roles: [role] }), /Only the business owner/);
  }
});

test('billing endpoints are rate limited per tenant', async () => {
  const s = fixture();
  let tooMany;
  for (let i = 0; i < 40 && !tooMany; i++) { try { await s.service.createOrder(s.owner, {}, BASE); } catch (e) { tooMany = e; } }
  assert.equal(tooMany?.getStatus?.(), 429);
});

// ----------------------------------------------------------------- verification --

test('a valid signature for a captured payment activates the plan with the correct validity', async () => {
  const s = fixture();
  const order = await s.service.createOrder(s.owner, {}, BASE);
  const pay = s.provider.pay(order.razorpayOrderId);
  const before = Date.now();
  const result = await s.service.verifyPayment(s.owner, verifyInput(order.razorpayOrderId, pay.id));
  assert.equal(result.state, 'APPLIED');
  assert.equal(result.activated, true);
  assert.equal(s.row.status, 'ACTIVE');
  assert.equal(s.row.billingModel, 'PREPAID');
  assert.ok(s.row.activatedAt instanceof Date);
  assert.ok(Math.abs(s.row.currentPeriodStart.getTime() - before) < 5000);
  assert.equal(s.row.expiresAt.getTime(), s.row.currentPeriodEnd.getTime());
  assert.equal(s.row.expiresAt.toISOString(), approxMonths(s.row.currentPeriodStart, 1).toISOString());
  assert.equal(s.orders[0].status, 'PAID');
  assert.equal(s.orders[0].razorpayPaymentId, pay.id);
  assert.equal(s.payments.get(pay.id).status, 'CAPTURED');
  assert.equal(s.payments.get(pay.id).providerOrderId, order.razorpayOrderId);
  assert.equal(evaluateSubscriptionAccess(s.row).allowed, true);
});

test('annual purchases grant one year', async () => {
  const s = fixture({ planId: 'growth', billingCycle: 'annual' });
  const order = await s.service.createOrder(s.owner, {}, BASE);
  const pay = s.provider.pay(order.razorpayOrderId);
  await s.service.verifyPayment(s.owner, verifyInput(order.razorpayOrderId, pay.id));
  const years = s.row.expiresAt.getUTCFullYear() - s.row.currentPeriodStart.getUTCFullYear();
  assert.equal(years, 1);
});

test('invalid, forged, wrong-order and wrong-payment signatures never activate', async () => {
  const s = fixture();
  const order = await s.service.createOrder(s.owner, {}, BASE);
  const pay = s.provider.pay(order.razorpayOrderId);
  await assert.rejects(s.service.verifyPayment(s.owner, verifyInput(order.razorpayOrderId, pay.id, 'a'.repeat(64))), /signature is invalid/);
  await assert.rejects(s.service.verifyPayment(s.owner, verifyInput(order.razorpayOrderId, pay.id, sign(order.razorpayOrderId, pay.id, 'other-secret'))), /signature is invalid/);
  // Recurring-subscription signature format (payment|subscription) must not verify.
  const legacyStyle = createHmac('sha256', 'test-key-secret').update(`${pay.id}|${order.razorpayOrderId}`).digest('hex');
  await assert.rejects(s.service.verifyPayment(s.owner, verifyInput(order.razorpayOrderId, pay.id, legacyStyle)), /signature is invalid/);
  // A signature for a different payment id.
  await assert.rejects(s.service.verifyPayment(s.owner, verifyInput(order.razorpayOrderId, pay.id, sign(order.razorpayOrderId, 'pay_other'))), /signature is invalid/);
  assert.equal(s.row.status, 'PENDING_ACTIVATION');
  assert.equal(s.payments.size, 0);
});

test('an unknown order or a payment that belongs to another order is rejected', async () => {
  const s = fixture();
  const order = await s.service.createOrder(s.owner, {}, BASE);
  await assert.rejects(s.service.verifyPayment(s.owner, verifyInput('order_Unknown1', 'pay_x1')), /does not belong/);
  // A genuinely paid payment of a DIFFERENT Razorpay order, replayed against ours.
  s.provider.orders.set('order_foreign', { id: 'order_foreign', amount: 99_900, currency: 'INR', status: 'created' });
  const foreign = s.provider.pay('order_foreign');
  await assert.rejects(s.service.verifyPayment(s.owner, verifyInput(order.razorpayOrderId, foreign.id)), /does not belong to this order/);
  assert.equal(s.row.status, 'PENDING_ACTIVATION');
});

test('tenant isolation: another tenant cannot verify, reuse or see this order', async () => {
  const s = fixture();
  const order = await s.service.createOrder(s.owner, {}, BASE);
  const pay = s.provider.pay(order.razorpayOrderId);
  const intruder = { id: 'x', tenantId: 'other-tenant', roles: ['BUSINESS_OWNER'] };
  await assert.rejects(s.service.verifyPayment(intruder, verifyInput(order.razorpayOrderId, pay.id)), /does not belong/);
  assert.equal(s.other.status, 'PENDING_ACTIVATION');
  assert.equal(s.row.status, 'PENDING_ACTIVATION');
  const status = await s.service.status(intruder);
  assert.equal(status.openOrder, null);
});

test('an authorized-only payment does not activate; the server captures the exact amount, then activates', async () => {
  const s = fixture();
  const order = await s.service.createOrder(s.owner, {}, BASE);
  const pay = s.provider.pay(order.razorpayOrderId, 'authorized');
  s.provider.captureError = new ServiceUnavailableException('capture unavailable');
  const pending = await s.service.verifyPayment(s.owner, verifyInput(order.razorpayOrderId, pay.id));
  assert.equal(pending.state, 'PENDING');
  assert.equal(pending.activated, false);
  assert.equal(s.row.status, 'PENDING_ACTIVATION');
  assert.equal(s.payments.get(pay.id).status, 'AUTHORIZED');

  s.provider.captureError = null;
  const ok = await s.service.verifyPayment(s.owner, verifyInput(order.razorpayOrderId, pay.id));
  assert.equal(ok.state, 'APPLIED');
  assert.deepEqual(s.provider.captures.at(-1), [pay.id, 99_900, 'INR']);
  assert.equal(s.row.status, 'ACTIVE');
});

test('a captured payment is never captured again', async () => {
  const s = fixture();
  const order = await s.service.createOrder(s.owner, {}, BASE);
  const pay = s.provider.pay(order.razorpayOrderId);
  await s.service.verifyPayment(s.owner, verifyInput(order.razorpayOrderId, pay.id));
  await s.service.verifyPayment(s.owner, verifyInput(order.razorpayOrderId, pay.id));
  assert.equal(s.provider.captures.length, 0);
});

test('wrong amount or currency is rejected, recorded, never captured and never activates', async () => {
  for (const bad of [{ amount: 100 }, { currency: 'USD' }]) {
    const s = fixture();
    const order = await s.service.createOrder(s.owner, {}, BASE);
    const pay = s.provider.pay(order.razorpayOrderId, 'authorized', bad);
    const result = await s.service.verifyPayment(s.owner, verifyInput(order.razorpayOrderId, pay.id));
    assert.equal(result.state, 'REJECTED');
    assert.equal(result.activated, false);
    assert.equal(s.row.status, 'PENDING_ACTIVATION');
    assert.equal(s.provider.captures.length, 0);
    assert.equal(s.payments.get(pay.id).status, 'REJECTED');
  }
});

test('a failed payment is recorded with a retry message and never activates; a later success does', async () => {
  const s = fixture();
  const order = await s.service.createOrder(s.owner, {}, BASE);
  const failed = s.provider.pay(order.razorpayOrderId, 'failed', { error_code: 'BAD_REQUEST_ERROR', error_description: 'Card declined' });
  const r1 = await s.service.verifyPayment(s.owner, verifyInput(order.razorpayOrderId, failed.id));
  assert.equal(r1.state, 'FAILED');
  assert.match(r1.message, /Card declined/);
  assert.equal(s.row.status, 'PENDING_ACTIVATION');
  assert.equal(s.orders[0].status, 'CREATED', 'the order stays open so the customer can retry');
  assert.equal(s.orders[0].failureCode, 'BAD_REQUEST_ERROR');
  // Retry on the SAME order.
  const retried = await s.service.createOrder(s.owner, {}, BASE);
  assert.equal(retried.reused, true);
  const good = s.provider.pay(order.razorpayOrderId);
  assert.equal((await s.service.verifyPayment(s.owner, verifyInput(order.razorpayOrderId, good.id))).state, 'APPLIED');
  assert.equal(s.payments.get(failed.id).status, 'FAILED');
  assert.equal(s.payments.get(good.id).status, 'CAPTURED');
});

// -------------------------------------------------- exactly-once / ordering --

test('callback + webhook + refresh for one captured payment extend validity exactly once', async () => {
  const s = fixture();
  const order = await s.service.createOrder(s.owner, {}, BASE);
  const pay = s.provider.pay(order.razorpayOrderId);
  await Promise.all([
    s.service.verifyPayment(s.owner, verifyInput(order.razorpayOrderId, pay.id)),
    webhook(s, 'payment.captured', paymentPayload(pay), 'evt_cap1'),
    webhook(s, 'order.paid', { ...paymentPayload(pay), order: { entity: { id: order.razorpayOrderId, status: 'paid' } } }, 'evt_paid1'),
    s.service.refresh(s.owner),
  ]);
  const end = s.row.expiresAt.getTime();
  await s.service.verifyPayment(s.owner, verifyInput(order.razorpayOrderId, pay.id));
  await webhook(s, 'payment.captured', paymentPayload(pay), 'evt_cap2');
  assert.equal(s.row.expiresAt.getTime(), end);
  assert.equal(s.orders.filter((o) => o.status === 'PAID').length, 1);
  assert.equal(s.payments.size, 1);
  assert.equal(s.row.status, 'ACTIVE');
});

test('webhook before the browser callback activates; the later callback is a harmless no-op', async () => {
  const s = fixture();
  const order = await s.service.createOrder(s.owner, {}, BASE);
  const pay = s.provider.pay(order.razorpayOrderId);
  await webhook(s, 'payment.captured', paymentPayload(pay), 'evt_early');
  assert.equal(s.row.status, 'ACTIVE');
  const end = s.row.expiresAt.getTime();
  const late = await s.service.verifyPayment(s.owner, verifyInput(order.razorpayOrderId, pay.id));
  assert.equal(late.state, 'ALREADY_APPLIED');
  assert.equal(s.row.expiresAt.getTime(), end);
});

test('callback before the webhook activates; the later webhook (and its replay) change nothing', async () => {
  const s = fixture();
  const order = await s.service.createOrder(s.owner, {}, BASE);
  const pay = s.provider.pay(order.razorpayOrderId);
  await s.service.verifyPayment(s.owner, verifyInput(order.razorpayOrderId, pay.id));
  const end = s.row.expiresAt.getTime();
  const first = await webhook(s, 'payment.captured', paymentPayload(pay), 'evt_late');
  const replay = await webhook(s, 'payment.captured', paymentPayload(pay), 'evt_late');
  const replayNewId = await webhook(s, 'payment.captured', paymentPayload(pay), 'evt_late_replayed_under_new_id');
  assert.deepEqual([first.duplicate, replay.duplicate, replayNewId.duplicate], [false, true, false]);
  assert.equal(s.row.expiresAt.getTime(), end);
  assert.equal(s.orders.filter((o) => o.status === 'PAID').length, 1);
});

test('a missing browser callback is recovered by the webhook, and by refresh without a webhook', async () => {
  const viaWebhook = fixture();
  const o1 = await viaWebhook.service.createOrder(viaWebhook.owner, {}, BASE);
  const p1 = viaWebhook.provider.pay(o1.razorpayOrderId);
  await webhook(viaWebhook, 'order.paid', { ...paymentPayload(p1), order: { entity: { id: o1.razorpayOrderId } } }, 'evt_orderpaid');
  assert.equal(viaWebhook.row.status, 'ACTIVE');

  const viaRefresh = fixture();
  const o2 = await viaRefresh.service.createOrder(viaRefresh.owner, {}, BASE);
  viaRefresh.provider.pay(o2.razorpayOrderId);
  const status = await viaRefresh.service.refresh(viaRefresh.owner);
  assert.equal(status.accessAllowed, true);
  assert.equal(viaRefresh.row.status, 'ACTIVE');
});

test('refresh with only a failed or pending payment stays inactive', async () => {
  const s = fixture();
  const order = await s.service.createOrder(s.owner, {}, BASE);
  s.provider.pay(order.razorpayOrderId, 'failed', { error_code: 'X', error_description: 'declined' });
  const status = await s.service.refresh(s.owner);
  assert.equal(status.accessAllowed, false);
  assert.equal(status.status, 'PENDING_ACTIVATION');
  assert.equal(status.paymentHistory[0].status, 'FAILED');
});

test('webhook payment.authorized records only; payment.failed never touches an active plan or a paid order', async () => {
  const s = fixture();
  const order = await s.service.createOrder(s.owner, {}, BASE);
  const auth = s.provider.pay(order.razorpayOrderId, 'authorized');
  await webhook(s, 'payment.authorized', paymentPayload(auth), 'evt_auth');
  assert.equal(s.row.status, 'PENDING_ACTIVATION');
  assert.equal(s.payments.get(auth.id).status, 'AUTHORIZED');
  assert.equal(s.provider.captures.length, 0, 'authorization alone triggers no capture or activation');

  const pay = s.provider.pay(order.razorpayOrderId, 'captured', { id: 'pay_good' });
  await webhook(s, 'payment.captured', paymentPayload(pay), 'evt_cap');
  assert.equal(s.row.status, 'ACTIVE');
  const end = s.row.expiresAt.getTime();
  // A separate failed attempt arrives later (even for the same order).
  await webhook(s, 'payment.failed', paymentPayload({ ...pay, id: 'pay_other_fail', status: 'failed', error_code: 'X', error_description: 'late failure' }), 'evt_fail');
  assert.equal(s.row.status, 'ACTIVE');
  assert.equal(s.row.expiresAt.getTime(), end);
  assert.equal(s.orders[0].status, 'PAID');
  assert.equal(s.payments.get('pay_good').status, 'CAPTURED');
  // And a late failure about the SAME paid payment must not downgrade it.
  await webhook(s, 'payment.failed', paymentPayload({ ...pay, status: 'failed' }), 'evt_fail_same');
  assert.equal(s.payments.get('pay_good').status, 'CAPTURED');
});

test('webhook: bad/missing signature, modified body and missing secret are rejected without side effects', async () => {
  const s = fixture();
  const body = Buffer.from('{"event":"payment.captured"}');
  await assert.rejects(s.service.processWebhook(Buffer.from(`${body.toString()} `), webhookSign(body), 'e1'), /signature is invalid/);
  await assert.rejects(s.service.processWebhook(body, 'z'.repeat(64), 'e2'), /signature is invalid/);
  await assert.rejects(s.service.processWebhook(body, webhookSign(body, 'wrong'), 'e3'), /signature is invalid/);
  await assert.rejects(s.service.processWebhook(body, undefined, 'e4'), /required/);
  const previous = process.env.RAZORPAY_WEBHOOK_SECRET;
  delete process.env.RAZORPAY_WEBHOOK_SECRET;
  try { await assert.rejects(s.service.processWebhook(body, webhookSign(body), 'e5'), /not configured/); } finally { process.env.RAZORPAY_WEBHOOK_SECRET = previous; }
  assert.equal(s.events.size, 0);
});

test('events without an event-id header are deduplicated by the signed body digest', async () => {
  const s = fixture();
  const body = Buffer.from(JSON.stringify({ event: 'payment.authorized', payload: {} }));
  assert.equal((await s.service.processWebhook(body, webhookSign(body), undefined)).duplicate, false);
  assert.equal((await s.service.processWebhook(body, webhookSign(body), undefined)).duplicate, true);
});

test('amount/currency mismatch in a captured webhook, or a payment for an unknown order, grants nothing', async () => {
  const s = fixture();
  const order = await s.service.createOrder(s.owner, {}, BASE);
  const wrong = s.provider.pay(order.razorpayOrderId, 'captured', { amount: 100 });
  await webhook(s, 'payment.captured', paymentPayload(wrong), 'evt_wrong_amount');
  assert.equal(s.row.status, 'PENDING_ACTIVATION');
  const unknown = await webhook(s, 'payment.captured', paymentPayload({ id: 'pay_x', order_id: 'order_notours', amount: 99_900, currency: 'INR', status: 'captured' }), 'evt_unknown_order');
  assert.equal(unknown.received, true);
  assert.equal(s.row.status, 'PENDING_ACTIVATION');
});

test('a provider outage while handling a webhook is not acknowledged, so Razorpay retries', async () => {
  const s = fixture();
  const order = await s.service.createOrder(s.owner, {}, BASE);
  const pay = s.provider.pay(order.razorpayOrderId);
  s.provider.listError = new ServiceUnavailableException('Razorpay down');
  await assert.rejects(webhook(s, 'payment.captured', paymentPayload(pay), 'evt_outage'), /Razorpay down/);
  assert.equal(s.events.size, 0);
  s.provider.listError = null;
  await webhook(s, 'payment.captured', paymentPayload(pay), 'evt_outage');
  assert.equal(s.row.status, 'ACTIVE');
});

test('a second captured payment for an already-paid order never extends again and is flagged for refund', async () => {
  const s = fixture();
  const order = await s.service.createOrder(s.owner, {}, BASE);
  const first = s.provider.pay(order.razorpayOrderId);
  await s.service.verifyPayment(s.owner, verifyInput(order.razorpayOrderId, first.id));
  const end = s.row.expiresAt.getTime();
  const second = s.provider.pay(order.razorpayOrderId, 'captured', { id: 'pay_double' });
  const result = await s.service.verifyPayment(s.owner, verifyInput(order.razorpayOrderId, second.id));
  assert.equal(result.state, 'ALREADY_APPLIED');
  assert.equal(s.row.expiresAt.getTime(), end);
  assert.equal(s.payments.get('pay_double').failureCode, 'DUPLICATE_PAYMENT');
});

// ------------------------------------------------------------- renewals/expiry --

test('early renewal extends from the existing expiry; the order is a RENEWAL', async () => {
  const expiry = new Date(Date.now() + 10 * DAY);
  const s = fixture({ status: 'ACTIVE', activatedAt: new Date(Date.now() - 20 * DAY), expiresAt: expiry, currentPeriodEnd: expiry });
  const order = await s.service.createOrder(s.owner, {}, BASE);
  assert.equal(order.purpose, 'RENEWAL');
  const pay = s.provider.pay(order.razorpayOrderId);
  await s.service.verifyPayment(s.owner, verifyInput(order.razorpayOrderId, pay.id));
  assert.equal(s.row.currentPeriodStart.getTime(), expiry.getTime());
  assert.equal(s.row.expiresAt.toISOString(), approxMonths(expiry, 1).toISOString());
  assert.equal(s.row.status, 'ACTIVE');
});

test('renewing an expired plan restores access starting from the verified payment time; data fields are untouched', async () => {
  const ended = new Date(Date.now() - 3 * DAY);
  const s = fixture({ status: 'EXPIRED', activatedAt: new Date(Date.now() - 40 * DAY), expiresAt: ended, currentPeriodEnd: ended });
  assert.equal(evaluateSubscriptionAccess(s.row).allowed, false);
  const order = await s.service.createOrder(s.owner, {}, BASE);
  const pay = s.provider.pay(order.razorpayOrderId);
  const before = Date.now();
  await s.service.verifyPayment(s.owner, verifyInput(order.razorpayOrderId, pay.id));
  assert.ok(Math.abs(s.row.currentPeriodStart.getTime() - before) < 5000);
  assert.equal(s.row.status, 'ACTIVE');
  assert.equal(evaluateSubscriptionAccess(s.row).allowed, true);
  assert.equal(s.row.tenantId, 'tenant-id');
});

test('duplicate renewals are prevented: concurrent taps share one order and a second early renewal beyond the window is refused', async () => {
  const expiry = new Date(Date.now() + 5 * DAY);
  const s = fixture({ status: 'ACTIVE', activatedAt: new Date(Date.now() - 25 * DAY), expiresAt: expiry, currentPeriodEnd: expiry });
  const [a, b] = await Promise.all([s.service.createOrder(s.owner, {}, BASE), s.service.createOrder(s.owner, {}, BASE)]);
  assert.equal(a.razorpayOrderId, b.razorpayOrderId);
  assert.equal(s.provider.created.length, 1);
  const pay = s.provider.pay(a.razorpayOrderId);
  await s.service.verifyPayment(s.owner, verifyInput(a.razorpayOrderId, pay.id));
  // Now paid ~35 days ahead on a monthly plan: another renewal must wait.
  await assert.rejects(s.service.createOrder(s.owner, {}, BASE), /already paid beyond the next renewal window/);
  const status = await s.service.status(s.owner);
  assert.equal(status.canPay, false);
});

test('expiry is enforced by timestamp even if the status is still ACTIVE', () => {
  const past = new Date(Date.now() - 1000);
  const future = new Date(Date.now() + DAY);
  assert.equal(evaluateSubscriptionAccess({ planId: 'starter', status: 'ACTIVE', expiresAt: past, currentPeriodEnd: past, billingModel: 'PREPAID' }).allowed, false);
  assert.equal(evaluateSubscriptionAccess({ planId: 'starter', status: 'ACTIVE', expiresAt: future, currentPeriodEnd: future, billingModel: 'PREPAID' }).allowed, true);
  assert.equal(evaluateSubscriptionAccess({ planId: 'starter', status: 'ACTIVE', expiresAt: null, currentPeriodEnd: null, billingModel: 'PREPAID' }).reason, 'NO_EXPIRY');
  assert.equal(evaluateSubscriptionAccess({ planId: 'starter', status: 'ACTIVE', expiresAt: future, currentPeriodEnd: future, billingModel: 'PREPAID' }, future.getTime()).allowed, false, 'denied from the exact expiry instant');
});

test('status reports validity, remaining days, history and expires an ended plan', async () => {
  const expiry = new Date(Date.now() + 7 * DAY + 1000);
  const s = fixture({ status: 'ACTIVE', activatedAt: new Date(Date.now() - 23 * DAY), expiresAt: expiry, currentPeriodEnd: expiry, lastPaymentAt: new Date() });
  const status = await s.service.status(s.owner);
  assert.equal(status.accessAllowed, true);
  assert.equal(status.daysRemaining, 8);
  assert.equal(status.purpose, 'RENEWAL');
  assert.equal(status.currency, 'INR');
  assert.equal(status.billingModel, 'PREPAID');

  const ended = new Date(Date.now() - DAY);
  const e = fixture({ status: 'ACTIVE', activatedAt: new Date(Date.now() - 40 * DAY), expiresAt: ended, currentPeriodEnd: ended });
  const expired = await e.service.status(e.owner);
  assert.equal(expired.status, 'EXPIRED');
  assert.equal(expired.accessAllowed, false);
  assert.equal(expired.daysRemaining, 0);
  assert.ok(expired.expiresAt instanceof Date, 'expiry stays visible for the renewal screen');
});

// ------------------------------------------------------------ legacy recurring --

test('legacy recurring subscription events are acknowledged and change nothing', async () => {
  const s = fixture({ razorpaySubscriptionId: 'sub_Tyksk517SEo1zc', billingModel: 'RECURRING', providerStatus: 'created' });
  for (const event of ['subscription.authenticated', 'subscription.activated', 'subscription.charged', 'subscription.halted', 'subscription.cancelled']) {
    const result = await webhook(s, event, { subscription: { entity: { id: 'sub_Tyksk517SEo1zc', plan_id: 'plan_x', status: 'active' } }, payment: { entity: { id: 'pay_legacy', order_id: 'order_legacy_invoice', amount: 99_900, currency: 'INR', status: 'captured' } } }, `evt_${event}`);
    assert.equal(result.received, true);
  }
  assert.equal(s.row.status, 'PENDING_ACTIVATION');
  assert.equal(s.row.providerStatus, 'created');
  assert.equal(s.payments.size, 0);
});

test('a legacy pending tenant can pay with a one-time order; the legacy subscription id is preserved', async () => {
  const s = fixture({ razorpaySubscriptionId: 'sub_Tyksk517SEo1zc', billingModel: 'RECURRING', providerStatus: 'created', providerCheckoutUrl: 'https://rzp.io/i/old' });
  const status = await s.service.status(s.owner);
  assert.equal(status.hasLegacyRecurringSubscription, true);
  const order = await s.service.createOrder(s.owner, {}, BASE);
  assert.ok(order.razorpayOrderId.startsWith('order_'));
  assert.equal(s.row.billingModel, 'PREPAID');
  const pay = s.provider.pay(order.razorpayOrderId);
  await s.service.verifyPayment(s.owner, verifyInput(order.razorpayOrderId, pay.id));
  assert.equal(s.row.status, 'ACTIVE');
  assert.equal(s.row.razorpaySubscriptionId, 'sub_Tyksk517SEo1zc');
  assert.equal(s.row.providerCheckoutUrl, 'https://rzp.io/i/old');
  assert.equal(s.provider.created.every((c) => c.id.startsWith('order_')), true, 'no recurring object is ever created');
});

test('an existing legacy ACTIVE tenant keeps access until its recorded end and can then renew manually', async () => {
  const end = new Date(Date.now() + 12 * DAY);
  const s = fixture({ status: 'ACTIVE', billingModel: 'RECURRING', razorpaySubscriptionId: 'sub_legacy1', activatedAt: new Date(Date.now() - 18 * DAY), currentPeriodEnd: end, expiresAt: null });
  assert.equal(evaluateSubscriptionAccess(s.row).allowed, true);
  const order = await s.service.createOrder(s.owner, {}, BASE);
  assert.equal(order.purpose, 'RENEWAL');
  const pay = s.provider.pay(order.razorpayOrderId);
  await s.service.verifyPayment(s.owner, verifyInput(order.razorpayOrderId, pay.id));
  assert.equal(s.row.currentPeriodStart.getTime(), end.getTime(), 'extends from the legacy period end');
  assert.equal(s.row.billingModel, 'PREPAID');
});

// ------------------------------------------------------------- hosted checkout --

test('hosted checkout tokens are bound to one order, expire, and cannot be tampered with', async () => {
  const s = fixture();
  const order = await s.service.createOrder(s.owner, {}, BASE);
  const token = s.service.issueCheckoutToken(order.orderId);
  await s.service.hostedCheckoutDetails(order.orderId, token);
  await assert.rejects(s.service.hostedCheckoutDetails('00000000-0000-4000-8000-000000000000', token), /Invalid checkout link/);
  await assert.rejects(s.service.hostedCheckoutDetails(order.orderId, `${token.slice(0, -1)}0`), /Invalid checkout link/);
  await assert.rejects(s.service.hostedCheckoutDetails(order.orderId, undefined), /expired/);
  await assert.rejects(s.service.hostedCheckoutDetails(order.orderId, s.service.issueCheckoutToken(order.orderId, Date.now() - 3_600_000)), /expired/);
});

test('hosted checkout callback needs the signed token AND a valid Razorpay signature, then activates the order tenant', async () => {
  const s = fixture();
  const order = await s.service.createOrder(s.owner, {}, BASE);
  const pay = s.provider.pay(order.razorpayOrderId);
  const token = s.service.issueCheckoutToken(order.orderId);
  await assert.rejects(s.service.hostedCheckoutCallback(order.orderId, undefined, { razorpayPaymentId: pay.id, razorpaySignature: sign(order.razorpayOrderId, pay.id) }), /expired/);
  await assert.rejects(s.service.hostedCheckoutCallback(order.orderId, token, { razorpayPaymentId: pay.id, razorpaySignature: 'a'.repeat(64) }), /signature is invalid/);
  assert.equal(s.row.status, 'PENDING_ACTIVATION');
  const ok = await s.service.hostedCheckoutCallback(order.orderId, token, { razorpayPaymentId: pay.id, razorpaySignature: sign(order.razorpayOrderId, pay.id) });
  assert.equal(ok.state, 'APPLIED');
  assert.equal(s.row.status, 'ACTIVE');
  assert.equal(s.other.status, 'PENDING_ACTIVATION');
  // Once paid, the checkout page is no longer available.
  await assert.rejects(s.service.hostedCheckoutDetails(order.orderId, token), /no longer available/);
});

// ----------------------------------------------------------------- HTTP provider --

function withEnv(values) {
  const previous = {};
  for (const [k, v] of Object.entries(values)) { previous[k] = process.env[k]; if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  return () => { for (const [k, v] of Object.entries(previous)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } };
}

test('HTTP provider sends a correct Orders API request (INR paise, receipt, notes) and validates the response', async () => {
  const restore = withEnv({ RAZORPAY_KEY_ID: 'rzp_test_public', RAZORPAY_KEY_SECRET: 'test-key-secret' });
  const original = global.fetch;
  const calls = [];
  global.fetch = async (url, options) => { calls.push({ url: String(url), options }); return { ok: true, json: async () => ({ id: 'order_Abc123', amount: 599_900, currency: 'INR', status: 'created' }) }; };
  try {
    const order = await new RazorpayHttpProvider().createOrder({ amountPaise: 599_900, currency: 'INR', receipt: 'bs_' + 'a'.repeat(50), notes: { tenant_id: 't' } });
    assert.equal(order.id, 'order_Abc123');
    assert.equal(calls[0].url, 'https://api.razorpay.com/v1/orders');
    assert.equal(calls[0].options.method, 'POST');
    const body = JSON.parse(calls[0].options.body);
    assert.deepEqual(Object.keys(body).sort(), ['amount', 'currency', 'notes', 'receipt']);
    assert.equal(body.amount, 599_900);
    assert.ok(body.receipt.length <= 40);
    assert.ok(calls[0].options.headers.Authorization.startsWith('Basic '));
    // A mismatching provider response is refused.
    global.fetch = async () => ({ ok: true, json: async () => ({ id: 'order_Abc123', amount: 1, currency: 'INR', status: 'created' }) });
    await assert.rejects(new RazorpayHttpProvider().createOrder({ amountPaise: 599_900, currency: 'INR', receipt: 'r', notes: {} }), /invalid order response/);
    await assert.rejects(new RazorpayHttpProvider().createOrder({ amountPaise: 5, currency: 'INR', receipt: 'r', notes: {} }), /Invalid order amount/);
  } finally { global.fetch = original; restore(); }
});

test('HTTP provider capture/list/fetch use the documented endpoints; errors never leak credentials', async () => {
  const restore = withEnv({ RAZORPAY_KEY_ID: 'rzp_test_public', RAZORPAY_KEY_SECRET: 'test-key-secret' });
  const original = global.fetch;
  const calls = [];
  global.fetch = async (url, options) => { calls.push([options.method, String(url).replace('https://api.razorpay.com', ''), options.body]); return { ok: true, json: async () => ({ items: [] }) }; };
  try {
    const p = new RazorpayHttpProvider();
    await p.capturePayment('pay_1', 99_900, 'INR');
    await p.listOrderPayments('order_1');
    await p.getOrder('order_1');
    await p.getPayment('pay_1');
    assert.deepEqual(calls, [
      ['POST', '/v1/payments/pay_1/capture', JSON.stringify({ amount: 99_900, currency: 'INR' })],
      ['GET', '/v1/orders/order_1/payments', undefined],
      ['GET', '/v1/orders/order_1', undefined],
      ['GET', '/v1/payments/pay_1', undefined],
    ]);
    global.fetch = async () => ({ ok: false, status: 400, json: async () => ({ error: { code: 'BAD_REQUEST_ERROR' } }) });
    await assert.rejects(p.getPayment('pay_1'), (e) => { assert.equal(e.getStatus(), 502); assert.doesNotMatch(e.message, /test-key-secret/); return true; });
    global.fetch = async () => ({ ok: false, status: 404, json: async () => ({}) });
    await assert.rejects(p.getOrder('order_x'), (e) => e instanceof NotFoundException);
    // Real Razorpay behaviour (verified against the Test API): 400 for an unknown id on a GET.
    global.fetch = async () => ({ ok: false, status: 400, json: async () => ({ error: { code: 'BAD_REQUEST_ERROR', description: 'The id provided does not exist', reason: 'input_validation_failed' } }) });
    await assert.rejects(p.getOrder('order_gone'), (e) => e instanceof NotFoundException);
    // ...but a 400 on a write, or an unrelated 400, is still a real rejection.
    global.fetch = async () => ({ ok: false, status: 400, json: async () => ({ error: { code: 'BAD_REQUEST_ERROR', description: 'The id provided does not exist' } }) });
    await assert.rejects(p.capturePayment('pay_1', 99_900, 'INR'), (e) => e.getStatus() === 502);
    global.fetch = async () => ({ ok: false, status: 500, json: async () => { throw new Error('x'); } });
    await assert.rejects(p.getOrder('order_x'), (e) => e.getStatus() === 503);
    global.fetch = async () => { throw new Error('network'); };
    await assert.rejects(p.getOrder('order_x'), /Unable to reach Razorpay/);
  } finally { global.fetch = original; restore(); }
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
  } finally { restore(); }
});
