'use strict';
// Production-endpoint refusal tests for the development-only database guard.
// Every URL here is synthetic (fake credentials). Nothing connects to a database:
// each refusal happens before any connection, and CLI cases run in a temp copy.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const guard = require('../scripts/safe-env/db-target-guard.cjs');

const backend = path.resolve(__dirname, '..');
const PROD = 'postgresql://user:SECRETPW123@ep-autumn-sunset-b3sbfmer.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';
const PROD_POOLER = 'postgresql://user:SECRETPW123@ep-autumn-sunset-b3sbfmer-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb';
const APK = 'postgresql://user:SECRETPW123@ep-late-sunset-b3cwjc8n.c-4.ap-southeast-1.aws.neon.tech/neondb';
const LOCAL = 'postgresql://owner:SECRETPW123@127.0.0.1:59999/it_db?schema=public';
const refuses = (fn, code) => assert.throws(fn, e => e instanceof guard.GuardRefusal && e.code === code && !String(e.message).includes('SECRETPW123'));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bs-guard-'));
const attestation = (o = {}) => {
  const file = path.join(tmp, 'att-' + Math.random().toString(16).slice(2) + '.json');
  fs.writeFileSync(file, JSON.stringify({ kind: guard.ATTESTATION_KIND, version: 1, host: '127.0.0.1', port: 59999, database: 'it_db', user: 'owner', systemIdentifier: '7705000000000000009', dataDirectory: 'C:/x/data', notNeon: true, ...o }));
  return file;
};
const env = (o = {}) => ({ NODE_ENV: 'development', DATABASE_URL: LOCAL, DIRECT_URL: LOCAL, BRANCHSUITE_LOCAL_DB_ATTESTATION: attestation(), ...o });

test('production, pooler, APK and other remote targets are refused without leaking secrets', () => {
  refuses(() => guard.classifyUrl(PROD, 'DATABASE_URL'), 'PRODUCTION_ENDPOINT_REFUSED');
  refuses(() => guard.classifyUrl(PROD_POOLER, 'DATABASE_URL'), 'PRODUCTION_ENDPOINT_REFUSED');
  refuses(() => guard.classifyUrl(APK, 'DATABASE_URL'), 'REMOTE_ENDPOINT_REFUSED');
  refuses(() => guard.classifyUrl('postgresql://u:SECRETPW123@ep-unknown-xyz.neon.tech/neondb', 'DATABASE_URL'), 'REMOTE_DATABASE_REFUSED');
  refuses(() => guard.classifyUrl('postgresql://u:SECRETPW123@db.example.com:5432/x', 'DATABASE_URL'), 'REMOTE_DATABASE_REFUSED');
  refuses(() => guard.classifyUrl('postgresql://u:SECRETPW123@10.0.0.5:5432/x', 'DATABASE_URL'), 'REMOTE_DATABASE_REFUSED');
});

test('unknown, ambiguous or malformed targets are refused', () => {
  refuses(() => guard.classifyUrl(undefined, 'DATABASE_URL'), 'DATABASE_TARGET_MISSING');
  refuses(() => guard.classifyUrl('', 'DATABASE_URL'), 'DATABASE_TARGET_MISSING');
  refuses(() => guard.classifyUrl('not a url', 'DATABASE_URL'), 'DATABASE_TARGET_UNPARSEABLE');
  refuses(() => guard.classifyUrl('mysql://u:SECRETPW123@127.0.0.1:3306/x', 'DATABASE_URL'), 'DATABASE_TARGET_UNKNOWN');
  refuses(() => guard.classifyUrl('postgresql://u:SECRETPW123@127.0.0.1:5432/x?host=ep-autumn-sunset-b3sbfmer.neon.tech', 'DATABASE_URL'), 'DATABASE_TARGET_AMBIGUOUS');
  refuses(() => guard.classifyUrl('postgresql://u:SECRETPW123@127.0.0.1:5432/x?options=-c%20x%3D1', 'DATABASE_URL'), 'DATABASE_TARGET_AMBIGUOUS');
  refuses(() => guard.classifyUrl('postgresql://u:SECRETPW123@127.0.0.1/x', 'DATABASE_URL'), 'DATABASE_TARGET_AMBIGUOUS');
  refuses(() => guard.classifyUrl('postgresql://u:SECRETPW123@127.0.0.1:5432/', 'DATABASE_URL'), 'DATABASE_TARGET_AMBIGUOUS');
  assert.deepEqual(guard.classifyUrl(LOCAL, 'DATABASE_URL'), { host: '127.0.0.1', port: 59999, database: 'it_db', user: 'owner' });
  assert.equal(guard.classifyUrl('postgresql://o:p@localhost:5000/d', 'x').host, '127.0.0.1');
});

test('static check: attested loopback passes; production env, DIRECT_URL mismatch and bad attestations refuse', () => {
  assert.equal(guard.assertSafeDatabaseTarget(env()).enforced, true);
  refuses(() => guard.assertSafeDatabaseTarget(env({ DATABASE_URL: PROD, DIRECT_URL: PROD })), 'PRODUCTION_ENDPOINT_REFUSED');
  refuses(() => guard.assertSafeDatabaseTarget(env({ DIRECT_URL: PROD })), 'PRODUCTION_ENDPOINT_REFUSED');
  refuses(() => guard.assertSafeDatabaseTarget(env({ DIRECT_URL: 'postgresql://owner:p@127.0.0.1:59998/it_db' })), 'DATABASE_TARGET_AMBIGUOUS');
  refuses(() => guard.assertSafeDatabaseTarget(env({ BRANCHSUITE_LOCAL_DB_ATTESTATION: undefined })), 'ATTESTATION_REQUIRED');
  refuses(() => guard.assertSafeDatabaseTarget(env({ BRANCHSUITE_LOCAL_DB_ATTESTATION: path.join(tmp, 'missing.json') })), 'ATTESTATION_UNREADABLE');
  refuses(() => guard.assertSafeDatabaseTarget(env({ BRANCHSUITE_LOCAL_DB_ATTESTATION: attestation({ kind: 'other' }) })), 'ATTESTATION_INVALID');
  refuses(() => guard.assertSafeDatabaseTarget(env({ BRANCHSUITE_LOCAL_DB_ATTESTATION: attestation({ notNeon: false }) })), 'ATTESTATION_INVALID');
  refuses(() => guard.assertSafeDatabaseTarget(env({ BRANCHSUITE_LOCAL_DB_ATTESTATION: attestation({ port: 1234 }) })), 'ATTESTATION_MISMATCH');
  refuses(() => guard.assertSafeDatabaseTarget(env({ BRANCHSUITE_LOCAL_DB_ATTESTATION: attestation({ database: 'other' }) })), 'ATTESTATION_MISMATCH');
  refuses(() => guard.assertSafeDatabaseTarget({ NODE_ENV: 'development' }), 'DATABASE_TARGET_MISSING');
});

test('enforcement is development-only but cannot be dodged by NODE_ENV when the launcher forces it', () => {
  assert.equal(guard.assertSafeDatabaseTarget({ NODE_ENV: 'production', DATABASE_URL: PROD }).enforced, false);
  assert.equal(guard.enforcementRequired({ NODE_ENV: 'production' }), false);
  assert.equal(guard.enforcementRequired({}), true);
  assert.equal(guard.enforcementRequired({ NODE_ENV: 'test' }), true);
  refuses(() => guard.assertSafeDatabaseTarget({ NODE_ENV: 'production', BRANCHSUITE_FORCE_LOCAL_GUARD: '1', DATABASE_URL: PROD }), 'PRODUCTION_ENDPOINT_REFUSED');
});

test('live identity must match the attestation exactly', () => {
  const a = { database: 'it_db', port: 59999, systemIdentifier: '7705000000000000009', dataDirectory: 'C:/x/data' };
  const row = { database: 'it_db', address: '127.0.0.1', port: 59999, system_identifier: '7705000000000000009', data_directory: 'c:\\x\\data', neon_endpoint: null };
  assert.equal(guard.assertLiveIdentity(row, a), true);
  for (const patch of [{ database: 'other' }, { address: '10.1.1.1' }, { port: 5432 }, { system_identifier: '7704995693964735928' }, { data_directory: 'C:/Program Files/PostgreSQL/18/data' }, { neon_endpoint: 'ep-autumn-sunset-b3sbfmer' }])
    refuses(() => guard.assertLiveIdentity({ ...row, ...patch }, a), 'LIVE_IDENTITY_MISMATCH');
  refuses(() => guard.assertLiveIdentity(undefined, a), 'LIVE_IDENTITY_UNAVAILABLE');
});

test('prisma.config: .env is not loaded, production target is refused, generate still works (temp copy, fake credentials)', () => {
  const dir = fs.mkdtempSync(path.join(tmp, 'cli-'));
  fs.mkdirSync(path.join(dir, 'prisma'));
  fs.mkdirSync(path.join(dir, 'scripts/safe-env'), { recursive: true });
  fs.copyFileSync(path.join(backend, 'scripts/safe-env/db-target-guard.cjs'), path.join(dir, 'scripts/safe-env/db-target-guard.cjs'));
  fs.copyFileSync(path.join(backend, 'prisma.config.cjs'), path.join(dir, 'prisma.config.cjs'));
  fs.writeFileSync(path.join(dir, 'prisma/schema.prisma'), 'datasource db {\n provider = "postgresql"\n url = env("DATABASE_URL")\n}\nmodel T {\n id Int @id\n}\n');
  fs.writeFileSync(path.join(dir, '.env'), 'NODE_ENV=development\nDATABASE_URL=' + PROD + '\n');
  const cli = path.join(backend, 'node_modules/prisma/build/index.js');
  const base = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot };
  const run = (args, extra = {}) => cp.spawnSync(process.execPath, [cli, ...args], { cwd: dir, env: { ...base, ...extra }, encoding: 'utf8', timeout: 60000, windowsHide: true });
  let r = run(['migrate', 'status']);
  assert.notEqual(r.status, 0);
  assert.match(r.stdout + r.stderr, /DATABASE_TARGET_MISSING/);
  assert.doesNotMatch(r.stdout + r.stderr, /SECRETPW123|ep-autumn/);
  r = run(['migrate', 'deploy'], { NODE_ENV: 'development', DATABASE_URL: PROD });
  assert.notEqual(r.status, 0);
  assert.match(r.stdout + r.stderr, /PRODUCTION_ENDPOINT_REFUSED/);
  assert.doesNotMatch(r.stdout + r.stderr, /SECRETPW123/);
  r = run(['db', 'push'], { NODE_ENV: 'development', DATABASE_URL: APK });
  assert.match(r.stdout + r.stderr, /REMOTE_ENDPOINT_REFUSED/);
  r = run(['validate'], { DATABASE_URL: LOCAL });
  assert.equal(r.status, 0);
});

const launcher = path.join(backend, 'scripts/safe-env/run.cjs');
const launch = (args, extraEnv = {}) => cp.spawnSync(process.execPath, [launcher, ...args], { cwd: backend, env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, ...extraEnv }, encoding: 'utf8', timeout: 30000, windowsHide: true });
const refusedWith = (r, code) => { assert.equal(r.status, 2, r.stdout + r.stderr); assert.match(r.stderr, new RegExp(code)); assert.doesNotMatch(r.stdout + r.stderr, /SECRETPW123/); };

test('launcher accepts only approved env files and tasks', () => {
  refusedWith(launch([]), 'TASK_REQUIRED|ENV_FILE');
  for (const f of ['.env', '.env.hosted.backup', '.env.local.backup', '../frontend/.env', 'C:/Windows/win.ini'])
    refusedWith(launch(['--env-file', f, 'check']), 'ENV_FILE_NOT_APPROVED');
});

test('launcher refuses a production DATABASE_URL even inside an approved-name env file, and URL/exec abuse', () => {
  const name = '.env.local-integration.refusal-test-' + process.pid;
  const file = path.join(backend, name);
  fs.writeFileSync(file, 'DATABASE_URL=' + PROD + '\nDIRECT_URL=' + PROD + '\nBRANCHSUITE_LOCAL_DB_ATTESTATION=' + attestation() + '\nPORT=4999\n');
  try {
    refusedWith(launch(['--env-file', file, 'start']), 'PRODUCTION_ENDPOINT_REFUSED');
    refusedWith(launch(['--env-file', file, 'prisma', 'migrate', 'deploy']), 'PRODUCTION_ENDPOINT_REFUSED');
    refusedWith(launch(['--env-file', file, 'check']), 'PRODUCTION_ENDPOINT_REFUSED');
    fs.writeFileSync(file, 'DATABASE_URL=' + APK + '\nDIRECT_URL=' + APK + '\nBRANCHSUITE_LOCAL_DB_ATTESTATION=' + attestation() + '\n');
    refusedWith(launch(['--env-file', file, 'seed']), 'REMOTE_ENDPOINT_REFUSED');
    fs.writeFileSync(file, 'DATABASE_URL=' + LOCAL + '\nDIRECT_URL=' + LOCAL + '\nBRANCHSUITE_LOCAL_DB_ATTESTATION=' + attestation() + '\n');
    refusedWith(launch(['--env-file', file, 'prisma', 'migrate', 'deploy', '--url', LOCAL]), 'PRISMA_URL_ARGUMENT_REFUSED');
    refusedWith(launch(['--env-file', file, 'prisma', 'migrate', 'deploy', PROD]), 'PRISMA_URL_ARGUMENT_REFUSED');
    refusedWith(launch(['--env-file', file, 'exec', '../backend/package.json']), 'EXEC_SCRIPT_NOT_APPROVED');
    refusedWith(launch(['--env-file', file, 'exec', 'C:/Windows/System32/calc.exe']), 'EXEC_SCRIPT_NOT_APPROVED');
    refusedWith(launch(['--env-file', file, 'frobnicate']), 'UNKNOWN_TASK');
  } finally {
    fs.rmSync(file, { force: true });
  }
});

test('PrismaService refuses production/unattested targets in development and stays inert in production', () => {
  require('reflect-metadata');
  const { PrismaService } = require('../src/prisma/prisma.service');
  const saved = { ...process.env };
  // Prisma Client auto-loads backend/.env for any variable that is NOT defined, so every
  // variable is defined explicitly (empty string = defined but unset to the guard).
  const set = o => { for (const k of ['NODE_ENV', 'BRANCHSUITE_LOCAL_DB_ATTESTATION', 'BRANCHSUITE_FORCE_LOCAL_GUARD']) delete process.env[k]; Object.assign(process.env, { DATABASE_URL: '', DIRECT_URL: '' }, o); };
  try {
    set({ NODE_ENV: 'development', DATABASE_URL: PROD, DIRECT_URL: PROD });
    refuses(() => new PrismaService(), 'PRODUCTION_ENDPOINT_REFUSED');
    set({ NODE_ENV: 'test', DATABASE_URL: LOCAL });
    refuses(() => new PrismaService(), 'ATTESTATION_REQUIRED');
    set({ NODE_ENV: 'development' });
    refuses(() => new PrismaService(), 'DATABASE_TARGET_MISSING');
    set({ NODE_ENV: 'development', DATABASE_URL: LOCAL, DIRECT_URL: LOCAL, BRANCHSUITE_LOCAL_DB_ATTESTATION: attestation() });
    assert.ok(new PrismaService());
    set({ NODE_ENV: 'production', DATABASE_URL: PROD });
    assert.ok(new PrismaService()); // hosted production unaffected; constructing does not connect
  } finally {
    for (const k of Object.keys(process.env)) delete process.env[k];
    Object.assign(process.env, saved);
  }
});

test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
