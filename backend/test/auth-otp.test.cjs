const assert = require('node:assert/strict');
const { test } = require('node:test');
require('reflect-metadata');
const { ValidationPipe } = require('@nestjs/common');
const bcrypt = require('bcrypt');
const { AuthService } = require('../src/modules/auth/auth.service');
const { OtpDestinationDto, VerifyOtpDto } = require('../src/modules/auth/dto/otp.dto');
const { ResetPasswordDto } = require('../src/modules/auth/dto/reset-password.dto');
process.env.JWT_SECRET ||= 'otp-unit-test-secret-at-least-32-characters';
const pipe = new ValidationPipe({ transform: true, whitelist: true });
const validate = (data, metatype) => pipe.transform(data, { type: 'body', metatype });

function fixture() {
  let record;
  let account = { id: 'user', status: 'ACTIVE', tenant: { status: 'ACTIVE' }, password: 'old', tokenVersion: 0 };
  let matches = [account];
  const sent = [];
  const eligible = (where) => record && Object.entries(where).every(([key, value]) => {
    if (value && typeof value === 'object') {
      if ('gt' in value) return record[key] > value.gt;
      if ('lte' in value) return record[key] <= value.lte;
      if ('lt' in value) return record[key] < value.lt;
      if ('not' in value) return record[key] !== value.not;
    }
    return record[key] === value;
  });
  const otpChallenge = {
    findFirst: async ({ where }) => eligible(where) ? { ...record } : null,
    upsert: async ({ create }) => record || (record = { id: 'initial', attempts: 0, ...create }),
    updateMany: async ({ where, data }) => {
      if (!eligible(where)) return { count: 0 };
      for (const [key, value] of Object.entries(data)) record[key] = value && typeof value === 'object' && 'increment' in value ? record[key] + value.increment : value;
      return { count: 1 };
    },
    findUniqueOrThrow: async () => ({ ...record }),
  };
  const prisma = { otpChallenge, user: {
    findMany: async () => matches,
    findFirst: async ({ where }) => where.status ? matches[0] || null : null,
    findUnique: async () => null,
    updateMany: async ({ data }) => { account.password = data.password; account.tokenVersion++; return { count: 1 }; },
  }, passwordResetToken: { updateMany: async () => ({ count: 0 }) } };
  prisma.$transaction = async callback => callback(prisma);
  const service = new AuthService(prisma, {});
  service.deliverOtp = async (email, otp) => sent.push({ email, otp });
  return { service, sent, record: () => record, account, setMatches: value => matches = value };
}
const destination = { email: 'owner@example.com' };

test('OTP destination accepts only email; reset requires numeric six-digit codes', async () => {
  const dto = await validate({ email: ' OWNER@example.com ' }, OtpDestinationDto);
  assert.equal(dto.email, 'owner@example.com');
  for (const data of [{ email: 'bad' }, { email: '9876543210' }, { channel: 'phone', destination: '9876543210' }, {}]) await assert.rejects(validate(data, OtpDestinationDto));
  for (const otp of ['abcdef', '12345', '1234567']) await assert.rejects(validate({ challengeId: '11111111-1111-4111-8111-111111111111', otp }, VerifyOtpDto));
  await assert.rejects(validate({ token: 'a'.repeat(64), newPassword: 'password123', confirmPassword: 'password123' }, ResetPasswordDto));
});

test('sends a six-digit OTP, persists only its keyed hash, and throttles resends', async () => {
  const f = fixture();
  const result = await f.service.forgotPassword(destination);
  assert.match(f.sent[0].otp, /^\d{6}$/);
  assert.notEqual(f.record().codeHash, f.sent[0].otp);
  assert.equal(result.otp, undefined);
  assert.equal(result.token, undefined);
  assert.equal((await f.service.forgotPassword(destination)).challengeId, result.challengeId);
  assert.equal(f.sent.length, 1);
});

test('requires verification before saving; saves bcrypt password, revokes sessions, prevents replay', async () => {
  const f = fixture();
  const { challengeId } = await f.service.forgotPassword(destination);
  const input = { challengeId, otp: f.sent[0].otp, newPassword: 'new-password123', confirmPassword: 'new-password123' };
  await assert.rejects(f.service.resetPassword(input));
  await f.service.verifyOtp(input);
  await f.service.resetPassword(input);
  assert.equal(await bcrypt.compare(input.newPassword, f.account.password), true);
  assert.equal(await bcrypt.compare('old-password', f.account.password), false);
  assert.equal(f.account.tokenVersion, 1);
  await assert.rejects(f.service.resetPassword(input));
});

test('rejects wrong, expired and exhausted OTPs', async () => {
  const f = fixture();
  const { challengeId } = await f.service.forgotPassword(destination);
  const wrong = f.sent[0].otp === '000000' ? '111111' : '000000';
  for (let i = 0; i < 5; i++) await assert.rejects(f.service.verifyOtp({ challengeId, otp: wrong }));
  await assert.rejects(f.service.verifyOtp({ challengeId, otp: f.sent[0].otp }));
  f.record().attempts = 0; f.record().expiresAt = new Date(0);
  await assert.rejects(f.service.verifyOtp({ challengeId, otp: f.sent[0].otp }));
});

test('a code verified on the fifth attempt can still complete password reset', async () => {
  const f = fixture();
  const { challengeId } = await f.service.forgotPassword(destination);
  const otp = f.sent[0].otp;
  const wrong = otp === '000000' ? '111111' : '000000';
  for (let i = 0; i < 4; i++) await assert.rejects(f.service.verifyOtp({ challengeId, otp: wrong }));
  await f.service.verifyOtp({ challengeId, otp });
  await f.service.resetPassword({ challengeId, otp, newPassword: 'new-password123', confirmPassword: 'new-password123' });
  assert.equal(await bcrypt.compare('new-password123', f.account.password), true);
  await assert.rejects(f.service.resetPassword({ challengeId, otp, newPassword: 'another-password123', confirmPassword: 'another-password123' }));
});

test('does not send reset OTP for a missing account', async () => {
  const f = fixture(); f.setMatches([]);
  const result = await f.service.forgotPassword(destination);
  assert.equal(f.sent.length, 0);
  assert.ok(result.challengeId);
  assert.match(result.message, /If an eligible account exists/);
});

test('previously issued phone challenges cannot verify or reset an account', async () => {
  const f = fixture();
  const { challengeId } = await f.service.forgotPassword(destination);
  f.record().channel = 'phone'; f.record().verifiedAt = new Date();
  const input = { challengeId, otp: f.sent[0].otp, newPassword: 'new-password123', confirmPassword: 'new-password123' };
  await assert.rejects(f.service.verifyOtp(input));
  await assert.rejects(f.service.resetPassword(input));
  assert.equal(f.account.password, 'old');
});

test('signup challenges cannot authorize password reset, and changed contacts cannot create an account', async () => {
  const f = fixture();
  const result = await f.service.requestSignupOtp(destination);
  await f.service.verifyOtp({ challengeId: result.challengeId, otp: f.sent[0].otp });
  await assert.rejects(f.service.resetPassword({ challengeId: result.challengeId, otp: f.sent[0].otp, newPassword: 'password123', confirmPassword: 'password123' }));
  f.service.checkOtp = async () => ({ id: 'proof', channel: 'email', destination: 'different@example.com' });
  await assert.rejects(f.service.signup({ businessName: 'Test', branchName: 'Main', ownerName: 'Owner', email: 'owner@example.com', phone: '9876543210', password: 'password123' }), /Verify the email/);
});

test('delivery failure invalidates the challenge and allows an immediate retry', async () => {
  const f = fixture(); f.service.deliverOtp = async () => { throw new Error('provider unavailable'); };
  await assert.rejects(f.service.forgotPassword(destination), error => {
    assert.match(error.message, /Unable to send OTP/);
    assert.equal(error.getStatus(), 503);
    return true;
  });
  assert.ok(f.record().usedAt);
  const failedId = f.record().id;
  f.service.deliverOtp = async (email, otp) => f.sent.push({ email, otp });
  const retry = await f.service.forgotPassword(destination);
  assert.notEqual(retry.challengeId, failedId);
  assert.equal(f.sent.length, 1);
  assert.equal(f.record().usedAt, null);
  await f.service.verifyOtp({ challengeId: retry.challengeId, otp: f.sent[0].otp });
});

test('delivery diagnostics include SMTP codes without exposing provider messages', async () => {
  const f = fixture();
  const logs = [];
  f.service.logger.error = message => logs.push(message);
  f.service.deliverOtp = async () => {
    throw Object.assign(new Error('secret-password recipient@example.com'), { code: 'EAUTH', responseCode: 535 });
  };
  await assert.rejects(f.service.forgotPassword(destination));
  assert.equal(logs.length, 1);
  assert.match(logs[0], /code=EAUTH, SMTP status=535/);
  assert.doesNotMatch(logs[0], /secret-password|recipient@example.com/);
});

for (const [environment, flag, redirected] of [
  ['development', 'true', true],
  ['test', 'true', true],
  ['production', 'true', false],
  [undefined, 'true', false],
  ['development', 'false', false],
]) {
  test(`OTP routing: NODE_ENV=${environment}, DEV_OTP_TO_SENDER=${flag}`, async t => {
    const settings = {
      NODE_ENV: environment, DEV_OTP_TO_SENDER: flag,
      SMTP_HOST: 'smtp.example.com', SMTP_PORT: '465',
      SMTP_USER: 'developer@example.com', SMTP_PASS: 'test-only-password',
    };
    const previous = Object.fromEntries(Object.keys(settings).map(key => [key, process.env[key]]));
    const restore = values => {
      for (const [key, value] of Object.entries(values)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    };
    t.after(() => restore(previous));
    restore(settings);
    const mail = [];
    t.mock.method(require('nodemailer'), 'createTransport', () => ({
      sendMail: async message => mail.push(message),
    }));
    const f = fixture();
    f.service.deliverOtp = AuthService.prototype.deliverOtp;
    const { challengeId } = await f.service.forgotPassword(destination);
    assert.equal(mail.length, 1);
    assert.equal(mail[0].to, redirected ? settings.SMTP_USER : destination.email);
    assert.equal(mail[0].subject.startsWith('[DEV:'), redirected);
    if (redirected) {
      assert.ok(mail[0].subject.includes(destination.email));
      assert.ok(mail[0].text.includes(`Development OTP for account: ${destination.email}`));
    }
    assert.equal(f.record().destination, destination.email);
    assert.equal(f.record().userId, f.account.id);
    const otp = mail[0].text.match(/^\d{6}$/m)[0];
    await f.service.verifyOtp({ challengeId, otp });
    assert.ok(f.record().verifiedAt);
  });
}

test('PostgreSQL signup, OTP reset and later login persist password changes atomically', { skip: process.env.RUN_AUTH_OTP_DB !== '1', timeout: 60000 }, async () => {
  require('dotenv/config');
  const { PrismaClient } = require('@prisma/client');
  const { JwtService } = require('@nestjs/jwt');
  const { randomUUID } = require('node:crypto');
  const prisma = new PrismaClient();
  const rollback = new Error('ROLLBACK_OTP_FIXTURE');
  try {
    await assert.rejects(prisma.$transaction(async tx => {
      const adapter = new Proxy(tx, { get: (target, key) => key === '$transaction' ? callback => callback(tx) : target[key] });
      const service = new AuthService(adapter, new JwtService({ secret: process.env.JWT_SECRET }));
      const sent = [];
      service.deliverOtp = async (email, otp) => sent.push({ email, otp });
      const email = `otp-${randomUUID()}@example.invalid`;
      const phone = `9${require('node:crypto').randomInt(100000000, 999999999)}`;
      const emailChallenge = await service.requestSignupOtp({ email });
      assert.equal(await tx.user.findUnique({ where: { email } }), null);
      const emailProof = { challengeId: emailChallenge.challengeId, otp: sent[0].otp };
      await service.verifyOtp(emailProof);
      const registration = await service.signup({ businessName: 'OTP fixture', branchName: 'Main branch', ownerName: 'OTP fixture owner',
        email, phone, password: 'original-password123', planId: 'starter', billingCycle: 'monthly',
        emailChallengeId: emailProof.challengeId, emailOtp: emailProof.otp });
      const oldLogin = await service.login({ email, password: 'original-password123', portal: 'staff' });
      const reset = await service.forgotPassword({ email });
      const resetInput = { challengeId: reset.challengeId, otp: sent[1].otp, newPassword: 'changed-password123', confirmPassword: 'changed-password123' };
      await service.verifyOtp(resetInput);
      await service.resetPassword(resetInput);
      const saved = await tx.user.findUniqueOrThrow({ where: { id: registration.user.id } });
      assert.equal(saved.phone, phone);
      assert.equal(await bcrypt.compare('changed-password123', saved.password), true);
      await assert.rejects(service.login({ email, password: 'original-password123', portal: 'staff' }));
      const login = await service.login({ email, password: 'changed-password123', portal: 'staff' });
      assert.equal(login.session.user.id, saved.id);
      await assert.rejects(service.me(`Bearer ${oldLogin.accessToken}`));
      await assert.rejects(service.resetPassword(resetInput));
      throw rollback;
    }, { maxWait: 10000, timeout: 45000 }), error => error === rollback);
  } finally { await prisma.$disconnect(); }
});
