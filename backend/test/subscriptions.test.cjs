require('reflect-metadata');
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const { test } = require('node:test');
const { Prisma } = require('@prisma/client');
const { SubscriptionsService } = require('../src/modules/subscriptions/subscriptions.service');
const { RazorpayHttpProvider } = require('../src/modules/subscriptions/razorpay.provider');

const initialSubscription = () => ({
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
});

class TestRazorpayProvider {
  constructor() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Test Razorpay provider is unavailable in production.');
    }
    this.created = 0;
    this.payment = {
      id: 'pay_test123',
      subscription_id: 'sub_test123',
      amount: 99_900,
      currency: 'INR',
      status: 'captured',
      created_at: 1_798_000_000,
    };
    this.subscription = {
      id: 'sub_test123',
      plan_id: 'plan_StarterMonthly',
      status: 'active',
      current_start: 1_798_000_000,
      current_end: 1_800_592_000,
    };
  }
  async createSubscription() {
    this.created += 1;
    return { ...this.subscription, status: 'created', short_url: 'https://rzp.io/i/test' };
  }
  async getSubscription() {
    return this.subscription;
  }
  async getPayment() {
    return this.payment;
  }
  publicKeyId() {
    return 'rzp_test_public';
  }
}

function fixture() {
  const subscription = initialSubscription();
  const payments = new Map();
  const webhookEvents = new Map();
  const provider = new TestRazorpayProvider();
  const tx = {
    $queryRaw: async () => [],
    businessSubscription: {
      findUnique: async ({ where }) => {
        const key = Object.keys(where)[0];
        return subscription[key] === where[key] ? { ...subscription } : null;
      },
      update: async ({ data }) => Object.assign(subscription, data),
    },
    subscriptionPayment: {
      findUnique: async ({ where }) => payments.get(where.providerPaymentId) ?? null,
      findFirst: async ({ where }) => {
        for (const payment of payments.values()) {
          if (Object.entries(where).every(([key, value]) => payment[key] === value)) {
            return { id: payment.id };
          }
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
          throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
            code: 'P2002',
            clientVersion: '6.19.3',
          });
        }
        webhookEvents.set(data.providerEventId, { id: data.providerEventId, ...data });
        return webhookEvents.get(data.providerEventId);
      },
      update: async ({ where, data }) => {
        const event = webhookEvents.get(where.providerEventId);
        Object.assign(event, data);
        return event;
      },
      findUnique: async ({ where }) => webhookEvents.get(where.providerEventId) ?? null,
    },
  };
  const prisma = {
    businessSubscription: tx.businessSubscription,
    razorpayWebhookEvent: tx.razorpayWebhookEvent,
    $transaction: async (callback) => callback(tx),
  };
  return {
    service: new SubscriptionsService(prisma, provider),
    prisma,
    provider,
    subscription,
    payments,
    webhookEvents,
    owner: { id: 'owner-id', tenantId: 'tenant-id', roles: ['BUSINESS_OWNER'] },
  };
}

function setEnv(key, value) {
  const previous = process.env[key];
  process.env[key] = value;
  return () => {
    if (previous === undefined) delete process.env[key];
    else process.env[key] = previous;
  };
}

test('checkout uses the saved plan and reuses an existing provider subscription', async () => {
  const state = fixture();
  const restoreSecret = setEnv('RAZORPAY_KEY_SECRET', 'test-key-secret');
  try {
    const first = await state.service.createCheckout(state.owner);
    const second = await state.service.createCheckout(state.owner);
    assert.equal(first.amountPaise, 99_900);
    assert.equal(first.razorpaySubscriptionId, 'sub_test123');
    assert.equal(first.keyId, 'rzp_test_public');
    assert.equal(second.razorpaySubscriptionId, first.razorpaySubscriptionId);
    assert.equal(state.provider.created, 1);
    assert.equal(state.subscription.status, 'PENDING_ACTIVATION');
  } finally {
    restoreSecret();
  }
});

test('owner signature verification activates only a provider-confirmed captured payment', async () => {
  const state = fixture();
  const restores = [
    setEnv('RAZORPAY_KEY_SECRET', 'test-key-secret'),
    setEnv('RAZORPAY_PLAN_STARTER_MONTHLY', 'plan_StarterMonthly'),
  ];
  try {
    const signature = createHmac('sha256', 'test-key-secret')
      .update('pay_test123|sub_test123')
      .digest('hex');
    const result = await state.service.verifyCheckout(state.owner, {
      razorpayPaymentId: 'pay_test123',
      razorpaySubscriptionId: 'sub_test123',
      razorpaySignature: signature,
    });
    assert.equal(result.verified, true);
    assert.equal(result.activated, true);
    assert.equal(state.subscription.status, 'ACTIVE');
    assert.equal(state.subscription.activatedAt instanceof Date, true);
    assert.equal(state.payments.get('pay_test123').status, 'CAPTURED');
  } finally {
    restores.reverse().forEach((restore) => restore());
  }
});

test('checkout authorization without a captured payment does not activate', async () => {
  const state = fixture();
  const restores = [
    setEnv('RAZORPAY_KEY_SECRET', 'test-key-secret'),
    setEnv('RAZORPAY_PLAN_STARTER_MONTHLY', 'plan_StarterMonthly'),
  ];
  state.provider.payment.status = 'authorized';
  try {
    const signature = createHmac('sha256', 'test-key-secret')
      .update('pay_test123|sub_test123')
      .digest('hex');
    const result = await state.service.verifyCheckout(state.owner, {
      razorpayPaymentId: 'pay_test123',
      razorpaySubscriptionId: 'sub_test123',
      razorpaySignature: signature,
    });
    assert.equal(result.verified, true);
    assert.equal(result.activated, false);
    assert.equal(state.subscription.status, 'PENDING_ACTIVATION');
  } finally {
    restores.reverse().forEach((restore) => restore());
  }
});

test('checkout verification rejects a different provider subscription', async () => {
  const state = fixture();
  const restoreSecret = setEnv('RAZORPAY_KEY_SECRET', 'test-key-secret');
  try {
    await assert.rejects(
      state.service.verifyCheckout(state.owner, {
        razorpayPaymentId: 'pay_test123',
        razorpaySubscriptionId: 'sub_other123',
        razorpaySignature: 'a'.repeat(64),
      }),
      /does not belong/,
    );
  } finally {
    restoreSecret();
  }
});

test('signed failed-payment webhook is idempotent and removes paid access', async () => {
  const state = fixture();
  state.subscription.status = 'ACTIVE';
  const restoreSecret = setEnv('RAZORPAY_WEBHOOK_SECRET', 'test-webhook-secret');
  const payload = {
    event: 'payment.failed',
    payload: {
      payment: {
        entity: {
          id: 'pay_failed123',
          subscription_id: 'sub_test123',
          amount: 99_900,
          currency: 'INR',
          status: 'failed',
          error_code: 'BAD_REQUEST_ERROR',
          error_description: 'Synthetic test failure',
          created_at: 1_798_000_000,
        },
      },
    },
  };
  const body = Buffer.from(JSON.stringify(payload));
  const signature = createHmac('sha256', 'test-webhook-secret').update(body).digest('hex');
  try {
    const first = await state.service.processWebhook(body, signature, 'evt_test123');
    const duplicate = await state.service.processWebhook(body, signature, 'evt_test123');
    assert.deepEqual(first, { received: true, duplicate: false });
    assert.deepEqual(duplicate, { received: true, duplicate: true });
    assert.equal(state.subscription.status, 'PAST_DUE');
    assert.equal(state.payments.get('pay_failed123').status, 'FAILED');
    assert.equal(state.webhookEvents.size, 1);
  } finally {
    restoreSecret();
  }
});

test('webhook signature must cover the exact raw body', async () => {
  const state = fixture();
  const restoreSecret = setEnv('RAZORPAY_WEBHOOK_SECRET', 'test-webhook-secret');
  const body = Buffer.from('{"event":"subscription.activated"}');
  const signature = createHmac('sha256', 'test-webhook-secret').update(body).digest('hex');
  try {
    await assert.rejects(
      state.service.processWebhook(Buffer.from(`${body.toString()} `), signature, 'evt_raw123'),
      /signature is invalid/,
    );
    assert.equal(state.webhookEvents.size, 0);
  } finally {
    restoreSecret();
  }
});

test('scheduled cancellation preserves paid access until the provider period ends', async () => {
  const state = fixture();
  state.subscription.status = 'ACTIVE';
  state.subscription.activatedAt = new Date();
  const restores = [
    setEnv('RAZORPAY_WEBHOOK_SECRET', 'test-webhook-secret'),
    setEnv('RAZORPAY_PLAN_STARTER_MONTHLY', 'plan_StarterMonthly'),
  ];
  const currentEnd = Math.floor(Date.now() / 1000) + 3600;
  const send = async (event, entity, eventId) => {
    const body = Buffer.from(JSON.stringify({
      event,
      payload: { subscription: { entity } },
    }));
    const signature = createHmac('sha256', 'test-webhook-secret').update(body).digest('hex');
    return state.service.processWebhook(body, signature, eventId);
  };
  try {
    await send('subscription.cancelled', {
      id: 'sub_test123',
      plan_id: 'plan_StarterMonthly',
      status: 'active',
      current_end: currentEnd,
      cancel_at_cycle_end: true,
    }, 'evt_scheduled_cancel');
    assert.equal(state.subscription.status, 'ACTIVE');
    assert.equal(state.subscription.cancelAtPeriodEnd, true);
    assert.equal(state.subscription.cancelledAt, null);
    assert.equal(state.subscription.expiresAt.getTime(), currentEnd * 1000);

    await send('subscription.completed', {
      id: 'sub_test123',
      plan_id: 'plan_StarterMonthly',
      status: 'completed',
      ended_at: currentEnd,
      current_end: currentEnd,
    }, 'evt_subscription_completed');
    assert.equal(state.subscription.status, 'EXPIRED');
  } finally {
    restores.reverse().forEach((restore) => restore());
  }
});

test('test provider cannot be instantiated when NODE_ENV is production', () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    assert.throws(() => new TestRazorpayProvider(), /unavailable in production/);
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});

test('HTTP provider confirms configured recurring-plan amount and interval before creation', async () => {
  const restores = [
    setEnv('RAZORPAY_KEY_ID', 'rzp_test_public'),
    setEnv('RAZORPAY_KEY_SECRET', 'test-key-secret'),
    setEnv('RAZORPAY_PLAN_STARTER_MONTHLY', 'plan_StarterMonthly'),
  ];
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    if (String(url).endsWith('/v1/plans/plan_StarterMonthly')) {
      return {
        ok: true,
        json: async () => ({
          id: 'plan_StarterMonthly',
          period: 'monthly',
          interval: 1,
          item: { amount: 99_900, currency: 'INR' },
        }),
      };
    }
    return {
      ok: true,
      json: async () => ({
        id: 'sub_test123',
        plan_id: 'plan_StarterMonthly',
        status: 'created',
      }),
    };
  };
  try {
    const result = await new RazorpayHttpProvider().createSubscription({
      planId: 'starter',
      billingCycle: 'monthly',
      tenantId: 'tenant-id',
    });
    assert.equal(result.id, 'sub_test123');
    assert.equal(calls.length, 2);
    assert.equal(JSON.parse(calls[1].options.body).total_count, 120);
    assert.equal(JSON.parse(calls[1].options.body).quantity, 1);
    assert.equal(calls[1].options.headers.Authorization.startsWith('Basic '), true);
  } finally {
    global.fetch = originalFetch;
    restores.reverse().forEach((restore) => restore());
  }
});

test('HTTP provider refuses a Razorpay plan with the wrong configured amount', async () => {
  const restores = [
    setEnv('RAZORPAY_KEY_ID', 'rzp_test_public'),
    setEnv('RAZORPAY_KEY_SECRET', 'test-key-secret'),
    setEnv('RAZORPAY_PLAN_STARTER_MONTHLY', 'plan_StarterMonthly'),
  ];
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      id: 'plan_StarterMonthly',
      period: 'monthly',
      interval: 1,
      item: { amount: 1, currency: 'INR' },
    }),
  });
  try {
    await assert.rejects(
      new RazorpayHttpProvider().createSubscription({
        planId: 'starter',
        billingCycle: 'monthly',
        tenantId: 'tenant-id',
      }),
      /does not match the selected price/,
    );
  } finally {
    global.fetch = originalFetch;
    restores.reverse().forEach((restore) => restore());
  }
});
