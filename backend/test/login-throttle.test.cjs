require('reflect-metadata');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { AuthService } = require('../src/modules/auth/auth.service');
const { AuthController } = require('../src/modules/auth/auth.controller');
const { throttleLogin } = require('../src/modules/auth/login-throttle');

function storage() {
  const counters = new Map();
  let now = 0, lookups = 0;
  const prisma = {
    $queryRaw: async (_sql, ...values) => values.map(key => {
      const old = counters.get(key);
      const row = old && old.expires > now ? { ...old, attempts: old.attempts + 1 } : { attempts: 1, expires: now + 900000 };
      counters.set(key, row);
      return { key, attempts: row.attempts };
    }),
    user: { findUnique: async () => { lookups++; return null; } },
  };
  return { prisma, counters, expire: () => { now += 900000; }, lookups: () => lookups };
}
const status = code => error => error.getStatus() === code;

test('unknown accounts are throttled across IPs, normalization and service instances before lookup', async () => {
  const f = storage();
  const services = [new AuthService(f.prisma, {}), new AuthService(f.prisma, {})];
  for (let i = 0; i < 10; i++) {
    await assert.rejects(services[i % 2].login({ email: i % 2 ? ' USER@example.com ' : 'user@example.com', password: 'wrong' }, `192.0.2.${i}`), status(401));
  }
  assert.equal(f.lookups(), 10);
  await assert.rejects(services[0].login({ email: 'user@example.com', password: 'correct' }, '198.51.100.1'), status(429));
  assert.equal(f.lookups(), 10);
  assert.ok([...f.counters.keys()].every(key => !key.includes('@') && !key.includes('192.0.2')));
  f.expire();
  await assert.rejects(services[1].login({ email: 'user@example.com', password: 'wrong' }, '198.51.100.1'), status(401));
});

test('IP throttle blocks password spraying across different accounts and mapped IPv4 forms', async () => {
  const f = storage();
  for (let i = 0; i < 100; i++) await throttleLogin(f.prisma, `user${i}@example.com`, i % 2 ? '::ffff:192.0.2.1' : '192.0.2.1');
  await assert.rejects(throttleLogin(f.prisma, 'another@example.com', '192.0.2.1'), status(429));
  await throttleLogin(f.prisma, 'another@example.com', '192.0.2.2');
});

test('concurrent attempts share the account budget and blocked requests do not extend the window', async () => {
  const f = storage();
  const results = await Promise.allSettled(Array.from({ length: 20 }, (_, i) => throttleLogin(f.prisma, 'user@example.com', `192.0.2.${i}`)));
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 10);
  f.expire();
  await throttleLogin(f.prisma, 'user@example.com', '192.0.2.1');
});

test('storage failure prevents login verification', async () => {
  const f = storage();
  f.prisma.$queryRaw = async () => { throw new Error('database unavailable'); };
  await assert.rejects(new AuthService(f.prisma, {}).login({ email: 'user@example.com', password: 'password' }, '192.0.2.1'), /database unavailable/);
  assert.equal(f.lookups(), 0);
});

test('password failures and successful logins both consume the account budget', async () => {
  const f = storage();
  const account = { id: 'user', tenantId: 'tenant', tokenVersion: 0, status: 'ACTIVE',
    password: require('bcrypt').hashSync('correct-password', 4), roles: [{ role: { name: 'EMPLOYEE' } }] };
  f.prisma.user.findUnique = async () => account;
  const service = new AuthService(f.prisma, { signAsync: async () => 'token' });
  service.getActiveUser = async () => account;
  service.makeSession = () => ({ memberships: [{ roles: ['EMPLOYEE'], branches: [{ id: 'branch' }] }] });
  const dto = { email: 'user@example.com', password: 'correct-password', portal: 'employee' };
  await assert.rejects(service.login({ ...dto, password: 'wrong' }, '192.0.2.1'), status(401));
  for (let i = 0; i < 9; i++) assert.equal((await service.login(dto, '192.0.2.1')).accessToken, 'token');
  await assert.rejects(service.login(dto, '192.0.2.1'), status(429));
});

test('login controller passes the framework client IP, ignoring user supplied forwarding headers', async () => {
  let received;
  const controller = new AuthController({ login: async (...args) => { received = args; } });
  const dto = { email: 'user@example.com', password: 'password' };
  await controller.login(dto, { ip: '192.0.2.1', headers: { 'x-forwarded-for': 'spoofed' } });
  assert.deepEqual(received, [dto, '192.0.2.1']);
});

test('PostgreSQL counters enforce account/IP budgets and reset expired windows', { skip: process.env.RUN_LOGIN_THROTTLE_DB !== '1' }, async () => {
  require('dotenv/config');
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  try {
    await prisma.$transaction(async tx => {
      // A connection-local table shadows any application table and disappears
      // at commit; this check never changes production counters or schema.
      await tx.$executeRaw`CREATE TEMP TABLE "LoginThrottle" (
        "key" TEXT PRIMARY KEY, "attempts" INTEGER NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL
      ) ON COMMIT DROP`;
      for (let i = 0; i < 10; i++) await throttleLogin(tx, 'user@example.com', `192.0.2.${i}`);
      await assert.rejects(throttleLogin(tx, ' USER@example.com ', '198.51.100.1'), status(429));
      await tx.$executeRaw`UPDATE "LoginThrottle" SET "expiresAt" = CURRENT_TIMESTAMP - INTERVAL '1 second'`;
      await throttleLogin(tx, 'user@example.com', '198.51.100.1');
      for (let i = 0; i < 100; i++) await throttleLogin(tx, `spray${i}@example.com`, '203.0.113.1');
      await assert.rejects(throttleLogin(tx, 'new@example.com', '203.0.113.1'), status(429));
    }, { timeout: 30000 });
  } finally { await prisma.$disconnect(); }
});
