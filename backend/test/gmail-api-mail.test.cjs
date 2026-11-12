// Gmail API mail delivery tests. Everything is mocked: no network, SMTP, Google
// or database access. Credentials below are fake test strings.
const assert = require('node:assert/strict');
const { test } = require('node:test');
require('reflect-metadata');
process.env.JWT_SECRET ||= 'otp-unit-test-secret-at-least-32-characters';
const nodemailer = require('nodemailer');
const { AuthService } = require('../src/modules/auth/auth.service');
const { createOtpEmail } = require('../src/modules/auth/email/otp-email');
const { GmailApiService, loadGmailConfig } = require('../src/modules/mail/gmail-api.service');
const { MailService } = require('../src/modules/mail/mail.service');
const { MailError, classifySendError, classifyTokenError } = require('../src/modules/mail/mail-error');

const GMAIL_ENV = {
  EMAIL_PROVIDER: 'gmail_api', GMAIL_CLIENT_ID: 'fake-client-id', GMAIL_CLIENT_SECRET: 'fake-client-secret-XYZ',
  GMAIL_REFRESH_TOKEN: 'fake-refresh-token-ABC', GMAIL_SENDER_EMAIL: 'sender@example.com',
  GMAIL_SENDER_NAME: 'BranchSuite Business',
};
function withEnv(t, values) {
  const keys = [...Object.keys(GMAIL_ENV), 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'SMTP_PORT', 'DEV_OTP_TO_SENDER', 'NODE_ENV'];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  for (const key of keys) delete process.env[key];
  Object.assign(process.env, values);
  t.after(() => { for (const key of keys) previous[key] === undefined ? delete process.env[key] : (process.env[key] = previous[key]); });
}
function blockSockets(t) {
  const calls = [];
  for (const mod of ['node:net', 'node:tls']) t.mock.method(require(mod), 'connect', (...args) => { calls.push(mod); throw new Error('network blocked in test'); });
  return calls;
}
function fakeGmail({ token = async () => 'access', send } = {}) {
  const sends = [];
  const service = new GmailApiService();
  service.clientFactory = () => ({
    oauth: { getAccessToken: token },
    gmail: { users: { messages: { send: async (params, options) => { sends.push({ params, options }); return send ? send(params) : { data: { id: 'msg-1' } }; } } } },
  });
  return { service, sends };
}
const decode = raw => Buffer.from(raw, 'base64url').toString('utf8');
const rawOf = sends => decode(sends[0].params.requestBody.raw);
const apiError = (status, body) => Object.assign(new Error('provider text with secret-address@example.com'), { response: { status, data: body } });

test('config loads from env, trims values and sanitises the display name', t => {
  withEnv(t, { ...GMAIL_ENV, GMAIL_SENDER_EMAIL: ' sender@example.com ', GMAIL_SENDER_NAME: 'Bad"\r\nName' });
  const config = loadGmailConfig();
  assert.equal(config.senderEmail, 'sender@example.com');
  assert.doesNotMatch(config.senderName, /["\r\n]/);
});

test('missing or invalid configuration fails safely with a sanitised code', t => {
  for (const missing of ['GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GMAIL_REFRESH_TOKEN', 'GMAIL_SENDER_EMAIL']) {
    withEnv(t, { ...GMAIL_ENV, [missing]: '' });
    assert.throws(() => loadGmailConfig(), error => error instanceof MailError && error.mailCode === 'CONFIG_MISSING' && error.message === 'CONFIG_MISSING');
  }
  withEnv(t, { ...GMAIL_ENV, GMAIL_SENDER_EMAIL: 'not-an-email' });
  assert.throws(() => loadGmailConfig(), /CONFIG_INVALID/);
  withEnv(t, { EMAIL_PROVIDER: 'carrier-pigeon' });
  assert.throws(() => new MailService().provider(), /CONFIG_INVALID/);
});

test('real OAuth2 client is built with client id/secret and the refresh token (no network)', t => {
  withEnv(t, GMAIL_ENV);
  const service = new GmailApiService();
  const clients = service.clientFactory(loadGmailConfig());
  assert.equal(typeof clients.oauth.getAccessToken, 'function');
  assert.equal(typeof clients.gmail.users.messages.send, 'function');
  assert.equal(clients.oauth.credentials.refresh_token, GMAIL_ENV.GMAIL_REFRESH_TOKEN);
  assert.equal(clients.oauth._clientId, GMAIL_ENV.GMAIL_CLIENT_ID);
});

test('gmail_api mode calls users.messages.send for userId "me" and opens no SMTP/TLS socket', async t => {
  withEnv(t, GMAIL_ENV);
  const sockets = blockSockets(t);
  const smtpTransports = [];
  const original = nodemailer.createTransport;
  t.mock.method(nodemailer, 'createTransport', options => { smtpTransports.push(options); return original(options); });
  const { service, sends } = fakeGmail();
  const mail = new MailService(service);
  await mail.send({ to: 'user@example.com', ...createOtpEmail('123456', 'signup') });
  assert.equal(sends.length, 1);
  assert.equal(sends[0].params.userId, 'me');
  assert.deepEqual(sockets, []);
  assert.ok(smtpTransports.every(options => options.streamTransport === true && !options.host), 'only the offline stream transport may be used');
  assert.equal(sends[0].options.retry, false);
});

test('MIME keeps subject, text, HTML, sender and the inline CID logo', async t => {
  withEnv(t, GMAIL_ENV);
  const { service, sends } = fakeGmail();
  const email = createOtpEmail('654321', 'reset');
  await new MailService(service).send({ to: 'user@example.com', ...email });
  const raw = rawOf(sends);
  assert.match(raw, /^From: "?BranchSuite Business"? <sender@example\.com>/m);
  assert.match(raw, /^To: user@example\.com/m);
  assert.match(raw, /^Subject: Your BranchSuite Business Password Reset Code/m);
  assert.match(raw, /multipart\/(related|mixed|alternative)/);
  assert.match(raw, /Content-Type: text\/plain/);
  assert.match(raw, /Content-Type: text\/html/);
  assert.match(raw, /Content-ID: <branchsuite-logo>/);
  assert.match(raw, /Content-Type: image\/png/);
  assert.ok(sends[0].params.requestBody.raw.match(/^[A-Za-z0-9_-]+$/), 'base64url alphabet, no padding or +/');
  // Decoded body parts contain the original OTP and template text.
  const parts = raw.split(/\n--/).map(part => part.includes('quoted-printable') ? require('node:buffer').Buffer.from(part, 'utf8').toString() : part).join('\n');
  assert.match(parts, /654321/);
});

test('Unicode subject and body survive UTF-8 encoding', async t => {
  withEnv(t, GMAIL_ENV);
  const { service, sends } = fakeGmail();
  await new MailService(service).send({ to: 'user@example.com', subject: 'कोड ✓ Ünïcode', text: 'नमस्ते ✓ 123456' });
  const raw = rawOf(sends);
  const subject = raw.match(/^Subject: (.*)$/m)[1];
  assert.match(subject, /=\?UTF-8\?/i);
  assert.equal(require('node:buffer').Buffer.from(subject.replace(/=\?UTF-8\?B\?(.*)\?=/i, '$1'), 'base64').toString('utf8'), 'कोड ✓ Ünïcode');
});

test('recipient header injection is rejected before any send', async t => {
  withEnv(t, GMAIL_ENV);
  const { service, sends } = fakeGmail();
  const mail = new MailService(service);
  for (const to of ['a@example.com\r\nBcc: evil@example.com', 'a@example.com, b@example.com', 'a b@example.com', 'x@y', '']) {
    await assert.rejects(mail.send({ to, subject: 's', text: 't' }), error => error.mailCode === 'MESSAGE_INVALID');
  }
  assert.equal(sends.length, 0);
});

test('error classification: revoked token, bad client, permissions, quota, rate limit, sender, 5xx, timeout', () => {
  assert.equal(classifyTokenError(apiError(400, { error: 'invalid_grant' })).mailCode, 'OAUTH_TOKEN_REVOKED');
  assert.equal(classifyTokenError(apiError(401, { error: 'invalid_client' })).mailCode, 'OAUTH_CLIENT_INVALID');
  assert.equal(classifyTokenError(Object.assign(new Error('x'), { code: 'ENOTFOUND' })).outcomeUnknown, false);
  const reason = (status, why, extra = {}) => classifySendError(apiError(status, { error: { errors: [{ reason: why }], ...extra } }));
  assert.equal(reason(401, 'authError').mailCode, 'OAUTH_TOKEN_REVOKED');
  assert.equal(reason(403, 'insufficientPermissions').mailCode, 'GMAIL_PERMISSION_DENIED');
  assert.equal(reason(403, 'dailyLimitExceeded').mailCode, 'GMAIL_QUOTA_EXCEEDED');
  assert.equal(reason(429, 'rateLimitExceeded').mailCode, 'GMAIL_RATE_LIMITED');
  assert.equal(reason(403, 'forbidden').mailCode, 'GMAIL_SENDER_REJECTED');
  assert.equal(reason(400, 'invalidArgument').mailCode, 'MESSAGE_INVALID');
  const upstream = reason(503, 'backendError');
  assert.equal(upstream.mailCode, 'GMAIL_UPSTREAM_ERROR');
  assert.equal(upstream.outcomeUnknown, true);
  const timeout = classifySendError(Object.assign(new Error('x'), { code: 'ETIMEDOUT' }));
  assert.equal(timeout.mailCode, 'NETWORK_TIMEOUT');
  assert.equal(timeout.outcomeUnknown, true);
  assert.equal(classifySendError(apiError(400, {})).outcomeUnknown, false);
  assert.doesNotMatch(classifySendError(apiError(403, {})).message, /secret-address/);
});

test('token failure is classified as not-sent; send is never attempted', async t => {
  withEnv(t, GMAIL_ENV);
  const { service, sends } = fakeGmail({ token: async () => { throw apiError(400, { error: 'invalid_grant' }); } });
  await assert.rejects(new MailService(service).send({ to: 'user@example.com', subject: 's', text: 't' }),
    error => error.mailCode === 'OAUTH_TOKEN_REVOKED' && error.outcomeUnknown === false);
  assert.equal(sends.length, 0);
});

test('HTTP 429 is retried exactly once; 5xx and timeouts are never retried', async t => {
  withEnv(t, GMAIL_ENV);
  let calls = 0;
  const { service } = fakeGmail({ send: async () => { calls++; if (calls === 1) throw apiError(429, { error: { errors: [{ reason: 'rateLimitExceeded' }] } }); return { data: { id: 'ok' } }; } });
  const mail = new MailService(service); mail.retryDelayMs = 0;
  await mail.send({ to: 'user@example.com', subject: 's', text: 't' });
  assert.equal(calls, 2);
  for (const failure of [apiError(503, {}), Object.assign(new Error('x'), { code: 'ETIMEDOUT' })]) {
    let attempts = 0;
    const fake = fakeGmail({ send: async () => { attempts++; throw failure; } });
    const m = new MailService(fake.service); m.retryDelayMs = 0;
    await assert.rejects(m.send({ to: 'user@example.com', subject: 's', text: 't' }));
    assert.equal(attempts, 1);
  }
  calls = 0;
  const always = fakeGmail({ send: async () => { calls++; throw apiError(429, {}); } });
  const m = new MailService(always.service); m.retryDelayMs = 0;
  await assert.rejects(m.send({ to: 'user@example.com', subject: 's', text: 't' }), /GMAIL_RATE_LIMITED/);
  assert.equal(calls, 2);
});

// ---- AuthService integration (mocked prisma, same fixture shape as auth-otp.test.cjs) ----
function authFixture(mail) {
  let record;
  const eligible = where => record && Object.entries(where).every(([key, value]) => {
    if (value && typeof value === 'object') {
      if ('gt' in value) return record[key] > value.gt;
      if ('lte' in value) return record[key] <= value.lte;
      if ('lt' in value) return record[key] < value.lt;
      if ('not' in value) return record[key] !== value.not;
    }
    return record[key] === value;
  });
  const prisma = { otpChallenge: {
    upsert: async ({ create }) => record || (record = { id: 'initial', attempts: 0, ...create }),
    updateMany: async ({ where, data }) => { if (!eligible(where)) return { count: 0 }; for (const [k, v] of Object.entries(data)) record[k] = v && typeof v === 'object' && 'increment' in v ? record[k] + v.increment : v; return { count: 1 }; },
    findFirst: async ({ where }) => eligible(where) ? { ...record } : null,
    findUniqueOrThrow: async () => ({ ...record }),
  }, user: { findFirst: async ({ where }) => where.status ? { id: 'user' } : null } };
  prisma.$queryRaw = async () => [{ attempts: 1 }];
  const service = new AuthService(prisma, {}, mail);
  return { service, record: () => record };
}
const target = { email: 'owner@example.com' };

test('successful Gmail send keeps OTP behaviour: hashed, verifiable, cooldown enforced', async t => {
  withEnv(t, GMAIL_ENV);
  const { service: gmail, sends } = fakeGmail();
  const f = authFixture(new MailService(gmail));
  const first = await f.service.requestSignupOtp(target);
  assert.match(first.message, /OTP sent/);
  const otp = decode(sends[0].params.requestBody.raw).match(/^\s*(\d{6})\s*$/m)[1];
  assert.ok(f.record().codeHash && !f.record().codeHash.includes(otp));
  assert.equal(f.record().usedAt, null);
  const again = await f.service.requestSignupOtp(target);
  assert.match(again.message, /wait 60 seconds/);
  assert.equal(sends.length, 1, 'cooldown must not send a second email');
  await f.service.verifyOtp({ challengeId: first.challengeId, otp });
});

test('definite Gmail failure invalidates the challenge and allows an immediate retry', async t => {
  withEnv(t, GMAIL_ENV);
  const logs = [];
  let fail = true;
  const { service: gmail } = fakeGmail({ send: async () => { if (fail) throw apiError(403, { error: { errors: [{ reason: 'insufficientPermissions' }] } }); return { data: {} }; } });
  const f = authFixture(new MailService(gmail));
  f.service.logger.error = message => logs.push(message);
  await assert.rejects(f.service.requestSignupOtp(target), error => error.getStatus() === 503 && /Unable to send OTP/.test(error.message));
  assert.ok(f.record().usedAt);
  assert.equal(f.record().sentAt.getTime(), 0);
  assert.match(logs[0], /code=GMAIL_PERMISSION_DENIED, http=403, outcomeUnknown=false/);
  fail = false;
  const retry = await f.service.requestSignupOtp(target);
  assert.match(retry.message, /OTP sent/);
  assert.equal(f.record().usedAt, null);
});

test('unknown outcome invalidates the code but keeps the cooldown (no duplicate email)', async t => {
  withEnv(t, GMAIL_ENV);
  let sendCalls = 0;
  const { service: gmail } = fakeGmail({ send: async () => { sendCalls++; throw Object.assign(new Error('x'), { code: 'ETIMEDOUT' }); } });
  const f = authFixture(new MailService(gmail));
  await assert.rejects(f.service.requestSignupOtp(target), error => error.getStatus() === 503);
  assert.ok(f.record().usedAt, 'ambiguous code must be unusable');
  assert.ok(f.record().sentAt.getTime() > 0, 'cooldown is kept');
  const again = await f.service.requestSignupOtp(target);
  assert.match(again.message, /wait 60 seconds/);
  assert.equal(sendCalls, 1);
});

test('secrets, OTP, tokens and addresses never appear in logs', async t => {
  withEnv(t, GMAIL_ENV);
  const logs = [];
  const { service: gmail } = fakeGmail({ send: async () => { throw apiError(401, { error: { message: 'Bearer ya29.fake-access-token owner@example.com' } }); } });
  const f = authFixture(new MailService(gmail));
  f.service.logger.error = message => logs.push(message);
  await assert.rejects(f.service.requestSignupOtp(target));
  const text = logs.join('\n');
  for (const secret of ['fake-client-secret-XYZ', 'fake-refresh-token-ABC', 'ya29', 'owner@example.com', 'fake-client-id']) assert.ok(!text.includes(secret), `${secret} leaked`);
  assert.match(text, /code=OAUTH_TOKEN_REVOKED/);
});

test('global send budget exhaustion returns 429 and leaves no usable code', async t => {
  withEnv(t, GMAIL_ENV);
  const { service: gmail, sends } = fakeGmail();
  const f = authFixture(new MailService(gmail));
  f.service.prisma.$queryRaw = async () => [{ attempts: 100000 }];
  await assert.rejects(f.service.requestSignupOtp(target), error => error.getStatus() === 429);
  assert.equal(sends.length, 0);
  assert.ok(f.record().usedAt);
});

test('per-IP throttle is skipped without TRUSTED_PROXY_CIDRS and enforced with it', async t => {
  withEnv(t, GMAIL_ENV);
  const { service: gmail } = fakeGmail();
  const f = authFixture(new MailService(gmail));
  let counter = 0;
  f.service.prisma.$queryRaw = async () => [{ attempts: ++counter > 1000 ? counter : 99 }];
  delete process.env.TRUSTED_PROXY_CIDRS;
  await f.service.requestSignupOtp(target, '203.0.113.9'); // no proxy list: not throttled per IP
  process.env.TRUSTED_PROXY_CIDRS = '10.0.0.0/8';
  t.after(() => delete process.env.TRUSTED_PROXY_CIDRS);
  await assert.rejects(f.service.forgotPassword(target, '203.0.113.9'), error => error.getStatus() === 429);
});
