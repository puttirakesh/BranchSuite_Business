// Hosted checkout (native apps) over the real Fastify adapter. Mocked Prisma/Razorpay.
require('reflect-metadata');
const assert = require('node:assert/strict');
const { test, before, after } = require('node:test');
const { createHmac } = require('node:crypto');
const { NestFactory } = require('@nestjs/core');
const { FastifyAdapter } = require('@nestjs/platform-fastify');
const { Module, ValidationPipe } = require('@nestjs/common');
const { HostedCheckoutController } = require('../src/modules/subscriptions/subscriptions.controller');
const { SubscriptionsService } = require('../src/modules/subscriptions/subscriptions.service');
const { renderCheckoutPage } = require('../src/modules/subscriptions/checkout-page');

process.env.RAZORPAY_KEY_SECRET = 'http-key-secret';
process.env.JWT_SECRET = 'http-jwt-secret';
const ORDER_ID = '11111111-1111-4111-8111-111111111111';
const order = { id: ORDER_ID, tenantId: 't', subscriptionId: 's', planId: 'scale', billingCycle: 'monthly', amountPaise: 599_900, currency: 'INR', razorpayOrderId: 'order_http1', status: 'CREATED', purpose: 'ACTIVATION' };
const prisma = { subscriptionOrder: { findUnique: async ({ where }) => (where.id === ORDER_ID ? { ...order } : null) } };
const razorpay = { publicKeyId: () => 'rzp_test_public', getPayment: async () => { throw new Error('should not be reached with a bad signature'); } };
const service = new SubscriptionsService(prisma, razorpay);

class TestModule {}
Module({ controllers: [HostedCheckoutController], providers: [{ provide: SubscriptionsService, useValue: service }] })(TestModule);

let app;
before(async () => {
  app = await NestFactory.create(TestModule, new FastifyAdapter(), { rawBody: true, logger: false });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
});
after(async () => { await app.close(); });
const inject = (opts) => app.getHttpAdapter().getInstance().inject(opts);
const base = `/api/v1/subscriptions`;

test('the hosted page renders with a valid token, with safe headers and no secret', async () => {
  const token = service.issueCheckoutToken(ORDER_ID);
  const res = await inject({ method: 'GET', url: `${base}/checkout-page/${ORDER_ID}?t=${token}`, headers: { host: 'api.example.test' } });
  assert.equal(res.statusCode, 200);
  assert.match(res.headers['content-type'], /text\/html/);
  assert.equal(res.headers['cache-control'], 'no-store');
  assert.equal(res.headers['referrer-policy'], 'no-referrer');
  assert.match(res.body, /checkout\.razorpay\.com\/v1\/checkout\.js/);
  assert.match(res.body, /order_http1/);
  assert.match(res.body, /https:\/\/api\.example\.test\/api\/v1\/subscriptions\/checkout-callback\//);
  assert.match(res.body, /branchsuitebusiness:\/\/billing/);
  assert.doesNotMatch(res.body, /http-key-secret|http-jwt-secret/);
});

test('the hosted page refuses missing, expired or tampered tokens and unknown orders', async () => {
  const good = service.issueCheckoutToken(ORDER_ID);
  const expired = service.issueCheckoutToken(ORDER_ID, Date.now() - 3_600_000);
  for (const url of [`${base}/checkout-page/${ORDER_ID}`, `${base}/checkout-page/${ORDER_ID}?t=${expired}`, `${base}/checkout-page/${ORDER_ID}?t=${good.slice(0, -2)}00`]) {
    assert.equal((await inject({ method: 'GET', url })).statusCode, 403, url);
  }
  const other = '22222222-2222-4222-8222-222222222222';
  assert.equal((await inject({ method: 'GET', url: `${base}/checkout-page/${other}?t=${service.issueCheckoutToken(other)}` })).statusCode, 404);
  assert.equal((await inject({ method: 'GET', url: `${base}/checkout-page/not-a-uuid?t=x` })).statusCode, 400);
});

test('the callback rejects a bad token, malformed bodies and a forged signature before any provider call', async () => {
  const token = service.issueCheckoutToken(ORDER_ID);
  const post = (t, payload) => inject({ method: 'POST', url: `${base}/checkout-callback/${ORDER_ID}?t=${t}`, headers: { 'content-type': 'application/json' }, payload: JSON.stringify(payload) });
  assert.equal((await post('bad.token', { razorpayPaymentId: 'pay_1', razorpaySignature: 'a'.repeat(64) })).statusCode, 403);
  assert.equal((await post(token, { razorpayPaymentId: 'nope', razorpaySignature: 'a'.repeat(64) })).statusCode, 400);
  assert.equal((await post(token, { razorpayPaymentId: 'pay_1' })).statusCode, 400);
  const forged = await post(token, { razorpayPaymentId: 'pay_1', razorpaySignature: 'a'.repeat(64) });
  assert.equal(forged.statusCode, 403);
  const valid = createHmac('sha256', 'http-key-secret').update('order_http1|pay_1').digest('hex');
  assert.notEqual(valid, 'a'.repeat(64));
});

test('page rendering escapes hostile text and never breaks out of the script block', () => {
  const html = renderCheckoutPage({ keyId: 'rzp_test_x', razorpayOrderId: 'order_x', amount: 99_900, currency: 'INR', description: '</script><img src=x onerror=alert(1)>', callbackUrl: 'https://a/b?t=1', returnUrl: 'branchsuitebusiness://billing' });
  assert.doesNotMatch(html, /<img src=x/);
  assert.doesNotMatch(html.split('<script>')[1].split('</script>')[0], /<\/script>/);
  assert.match(html, /₹999/);
});
