'use strict';
// Offline tests for provision-platform-user.cjs. In-memory fake transaction; no database.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const p = require('./provision-platform-user.cjs');

const PW = 'Synthetic-Unit-Test-Pw-123';
const fakeHash = async (pw, rounds) => `$2b$${rounds}$` + Buffer.from(pw).toString('hex').padEnd(53, '0').slice(0, 53);
const fakeCompare = async (pw, h) => h === (await fakeHash(pw, 12));
const env = { SEED_PLATFORM_ADMIN_EMAIL: '  Admin@BranchSuite.example ', SEED_PLATFORM_ADMIN_PASSWORD: PW };

function fakeTx({ users = [], endpoint = 'ep-late-sunset-b3cwjc8n', finished = 44, unfinished = 0, cols } = {}) {
  const rows = users.map(u => ({ ...u }));
  const columns = cols || ['id', 'name', 'email', 'passwordHash', 'role', 'status', 'tokenVersion', 'createdAt', 'updatedAt', 'lastLoginAt'];
  return {
    rows,
    $executeRawUnsafe: async () => 0,
    $queryRawUnsafe: async sql => {
      if (/neon\.endpoint_id/.test(sql)) return [{ database: 'neondb', neon_endpoint: endpoint }];
      if (/_prisma_migrations/.test(sql)) return [{ finished, unfinished }];
      if (/information_schema/.test(sql)) return columns.map(column_name => ({ column_name }));
      throw new Error('unexpected SQL');
    },
    platformUser: {
      count: async () => rows.length,
      findUnique: async ({ where }) => rows.find(r => r.email === where.email) || null,
      create: async ({ data }) => { const r = { id: 'new-id', tokenVersion: 0, ...data }; rows.push(r); return r; },
      update: async ({ where, data }) => {
        const r = rows.find(x => x.id === where.id);
        if (data.passwordHash) r.passwordHash = data.passwordHash;
        if (data.tokenVersion?.increment) r.tokenVersion += data.tokenVersion.increment;
        return r;
      },
    },
  };
}
const deps = { hash: fakeHash, compare: fakeCompare };
const input = () => p.accountInput(env, 'admin');

test('arguments: plan by default; execute needs exact target, approval and backup; no secrets on CLI', () => {
  assert.equal(p.parseArgs(['--role', 'admin', '--mode', 'create']).execute, false);
  const ok = ['--role', 'admin', '--mode', 'create', '--execute', '--confirm-target', 'ep-late-sunset-b3cwjc8n', '--approval', 'KK 2026-11-09', '--backup-file', 'x.dump'];
  assert.equal(p.parseArgs(ok).execute, true);
  const without = flag => ok.filter((a, i) => a !== flag && ok[i - 1] !== flag);
  assert.throws(() => p.parseArgs(without('--confirm-target')), e => e.code === 'TARGET_CONFIRMATION_REQUIRED');
  assert.throws(() => p.parseArgs([...without('--confirm-target'), '--confirm-target', 'ep-autumn-sunset-b3sbfmer']), e => e.code === 'TARGET_CONFIRMATION_REQUIRED');
  assert.throws(() => p.parseArgs(without('--approval')), e => e.code === 'APPROVAL_REFERENCE_REQUIRED');
  assert.throws(() => p.parseArgs(without('--backup-file')), e => e.code === 'BACKUP_REQUIRED');
  assert.throws(() => p.parseArgs(['--role', 'admin', '--mode', 'create', '--password', 'x']), e => e.code === 'SECRET_ARGUMENT_REFUSED');
  assert.throws(() => p.parseArgs(['--role', 'owner', '--mode', 'create']), e => e.code === 'ROLE_REQUIRED');
  assert.throws(() => p.parseArgs(['--role', 'admin', '--mode', 'delete']), e => e.code === 'MODE_REQUIRED');
});

test('input: email normalized like login; weak or missing password refused', () => {
  assert.equal(input().email, 'admin@branchsuite.example');
  assert.equal(input().role, 'PLATFORM_ADMIN');
  assert.equal(p.accountInput({ SEED_PLATFORM_SUPPORT_EMAIL: 's@x.example', SEED_PLATFORM_SUPPORT_PASSWORD: PW }, 'support').role, 'PLATFORM_SUPPORT');
  assert.throws(() => p.accountInput({ ...env, SEED_PLATFORM_ADMIN_PASSWORD: 'short' }, 'admin'), e => e.code === 'PASSWORD_LENGTH');
  assert.throws(() => p.accountInput({ SEED_PLATFORM_ADMIN_EMAIL: 'a@b.example' }, 'admin'), e => e.code === 'PASSWORD_REQUIRED');
  assert.throws(() => p.accountInput({ SEED_PLATFORM_ADMIN_PASSWORD: PW }, 'admin'), e => e.code === 'EMAIL_REQUIRED');
});

test('create: inserts one ACTIVE account with cost-12 bcrypt; retry is a no-op; other accounts untouched', async () => {
  const other = { id: 'other', email: 'other@x.example', role: 'PLATFORM_SUPPORT', status: 'ACTIVE', tokenVersion: 3, passwordHash: 'keep' };
  const tx = fakeTx({ users: [other] });
  const r = await p.applyAction(tx, input(), 'create', deps);
  assert.equal(r.action, 'CREATE'); assert.equal(r.platformUsersAfter, 2);
  const created = tx.rows.find(x => x.email === 'admin@branchsuite.example');
  assert.equal(created.status, 'ACTIVE'); assert.equal(created.role, 'PLATFORM_ADMIN');
  assert.match(created.passwordHash, /^\$2b\$12\$/);
  assert.ok(await fakeCompare(PW, created.passwordHash));
  assert.deepEqual(tx.rows.find(x => x.id === 'other'), other);
  const again = await p.applyAction(tx, input(), 'create', deps);
  assert.equal(again.action, 'NOOP_ALREADY_EXISTS'); assert.equal(tx.rows.length, 2);
});

test('create never modifies an existing (e.g. suspended) account', async () => {
  const existing = { id: 'a', email: 'admin@branchsuite.example', role: 'PLATFORM_SUPPORT', status: 'SUSPENDED', tokenVersion: 1, passwordHash: 'old' };
  const tx = fakeTx({ users: [existing] });
  const r = await p.applyAction(tx, input(), 'create', deps);
  assert.equal(r.action, 'NOOP_ALREADY_EXISTS'); assert.match(r.note, /SUSPENDED/);
  assert.deepEqual(tx.rows[0], existing);
});

test('reset-password: re-hashes, increments tokenVersion (signs out sessions), keeps role/status; idempotent', async () => {
  const tx = fakeTx({ users: [{ id: 'a', email: 'admin@branchsuite.example', role: 'PLATFORM_ADMIN', status: 'ACTIVE', tokenVersion: 4, passwordHash: 'old-hash' }] });
  const r = await p.applyAction(tx, input(), 'reset-password', deps);
  assert.equal(r.action, 'RESET_PASSWORD'); assert.equal(r.tokenVersionBefore, 4); assert.equal(r.tokenVersionAfter, 5);
  assert.equal(tx.rows[0].role, 'PLATFORM_ADMIN'); assert.equal(tx.rows[0].status, 'ACTIVE');
  const again = await p.applyAction(tx, input(), 'reset-password', deps);
  assert.equal(again.action, 'NOOP_PASSWORD_UNCHANGED'); assert.equal(tx.rows[0].tokenVersion, 5);
  await assert.rejects(p.applyAction(fakeTx(), input(), 'reset-password', deps), e => e.code === 'ACCOUNT_NOT_FOUND');
});

test('preconditions: wrong endpoint, incomplete migrations or missing columns refuse before any write', async () => {
  for (const [opts, code] of [[{ endpoint: 'ep-autumn-sunset-b3sbfmer' }, 'LIVE_IDENTITY_MISMATCH'], [{ endpoint: null }, 'LIVE_IDENTITY_MISMATCH'],
    [{ finished: 41 }, 'SCHEMA_NOT_READY'], [{ unfinished: 1 }, 'SCHEMA_NOT_READY'], [{ cols: ['id', 'email'] }, 'SCHEMA_NOT_READY']]) {
    const tx = fakeTx(opts);
    await assert.rejects(p.applyAction(tx, input(), 'create', deps), e => e.code === code, JSON.stringify(opts));
    assert.equal(tx.rows.length, 0);
  }
});

test('result and audit record contain no password or hash', async () => {
  const tx = fakeTx();
  const r = await p.applyAction(tx, input(), 'create', deps);
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'bs-audit-')), 'audit.jsonl');
  p.writeAudit({ email: p.maskEmail(input().email), ...r }, file);
  const text = fs.readFileSync(file, 'utf8') + JSON.stringify(r);
  assert.doesNotMatch(text, new RegExp(PW)); assert.doesNotMatch(text, /\$2b\$/); assert.doesNotMatch(text, /admin@branchsuite/);
  assert.match(text, /ad\*\*\*@branchsuite\.example/);
});

test('backup must exist, be recent and readable', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bs-bk-'));
  assert.throws(() => p.checkBackup(path.join(dir, 'missing.dump')), e => e.code === 'BACKUP_NOT_FOUND');
  const small = path.join(dir, 'small.dump'); fs.writeFileSync(small, 'x');
  assert.throws(() => p.checkBackup(small), e => e.code === 'BACKUP_INVALID');
  const old = path.join(dir, 'old.dump'); fs.writeFileSync(old, Buffer.alloc(2048));
  assert.throws(() => p.checkBackup(old, Date.now() + 7 * 3600 * 1000), e => e.code === 'BACKUP_TOO_OLD');
  assert.throws(() => p.checkBackup(old), e => e.code === 'BACKUP_UNREADABLE'); // not a pg_dump archive
});
