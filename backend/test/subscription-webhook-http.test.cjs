// Drives the REAL Fastify adapter + Nest raw-body configuration used in main.ts,
// so the webhook signature is verified against the exact bytes on the wire.
// Prisma and Razorpay are in-memory doubles (no network, no database).
require('reflect-metadata');
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const { test, before, after } = require('node:test');
const { NestFactory } = require('@nestjs/core');
const { FastifyAdapter } = require('@nestjs/platform-fastify');
const { Module, ValidationPipe } = require('@nestjs/common');
const { Prisma } = require('@prisma/client');
const { RazorpayWebhookController } = require('../src/modules/subscriptions/subscriptions.controller');
const { SubscriptionsService } = require('../src/modules/subscriptions/subscriptions.service');

process.env.RAZORPAY_WEBHOOK_SECRET = 'http-test-webhook-secret';
const events = new Map();
const prisma = {
  businessSubscription: { findUnique: async () => null },
  razorpayWebhookEvent: {
    create: async ({ data }) => {
      if (events.has(data.providerEventId)) {
        throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: '6.19.3' });
      }
      events.set(data.providerEventId, { ...data });
    },
    update: async ({ where, data }) => { Object.assign(events.get(where.providerEventId), data); },
    findUnique: async ({ where }) => events.get(where.providerEventId) ?? null,
  },
  $transaction: async (callback) => callback(prisma),
};
const service = new SubscriptionsService(prisma, {});

class TestModule {}
Module({ controllers: [RazorpayWebhookController], providers: [{ provide: SubscriptionsService, useValue: service }] })(TestModule);

let app;
before(async () => {
  // Mirrors backend/src/main.ts: Fastify adapter, rawBody enabled, global prefix + validation.
  app = await NestFactory.create(TestModule, new FastifyAdapter({ bodyLimit: 8 * 1024 * 1024 }), { rawBody: true, logger: false });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
});
after(async () => { await app.close(); });

const URL = '/api/v1/subscriptions/webhooks/razorpay';
const sign = (body) => createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).update(body).digest('hex');
const post = (payload, headers) => app.getHttpAdapter().getInstance().inject({ method: 'POST', url: URL, headers: { 'content-type': 'application/json', ...headers }, payload });

test('a correctly signed body is accepted with HTTP 200, even with odd whitespace and unicode', async () => {
  // Re-serialising would change these bytes; the signature only matches the raw body.
  const body = '{ "entity":"event",\n  "event":"subscription.authenticated" , "payload":{"note":"₹ 5,999 – café"} }';
  const response = await post(body, { 'x-razorpay-signature': sign(body), 'x-razorpay-event-id': 'evt_http_1' });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { received: true, duplicate: false });
  assert.ok(events.get('evt_http_1').processedAt instanceof Date);
});

test('a duplicate delivery is acknowledged with 200 and flagged as duplicate', async () => {
  const body = '{"event":"subscription.authenticated","payload":{}}';
  const headers = { 'x-razorpay-signature': sign(body), 'x-razorpay-event-id': 'evt_http_dup' };
  await post(body, headers);
  const again = await post(body, headers);
  assert.equal(again.statusCode, 200);
  assert.deepEqual(again.json(), { received: true, duplicate: true });
});

test('an invalid or missing signature is rejected without storing the event', async () => {
  const body = '{"event":"subscription.activated","payload":{}}';
  const stored = events.size;
  const wrong = await post(body, { 'x-razorpay-signature': 'f'.repeat(64), 'x-razorpay-event-id': 'evt_http_bad' });
  assert.equal(wrong.statusCode, 403);
  const tampered = await post(`${body} `, { 'x-razorpay-signature': sign(body), 'x-razorpay-event-id': 'evt_http_tamper' });
  assert.equal(tampered.statusCode, 403);
  const missing = await post(body, { 'x-razorpay-event-id': 'evt_http_missing' });
  assert.equal(missing.statusCode, 400);
  assert.equal(events.size, stored);
});

test('an empty body is rejected', async () => {
  const response = await post('', { 'x-razorpay-signature': sign(''), 'x-razorpay-event-id': 'evt_empty' });
  assert.ok(response.statusCode >= 400 && response.statusCode < 500);
});
