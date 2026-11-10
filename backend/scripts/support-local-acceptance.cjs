'use strict';

// Local-only HTTP acceptance runner. Never load the configured production URL into a test client.
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { spawn, spawnSync } = require('node:child_process');
const { randomBytes, createHash } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');

const backend = path.resolve(__dirname, '..');
const root = path.dirname(backend);
const children = [];
const results = { startedAt: new Date().toISOString(), status: 'starting', backend: 'http://127.0.0.1:4241/api/v1', business: 'http://127.0.0.1:8181', superadmin: 'http://127.0.0.1:8182' };
const envPaths = ['backend/.env', 'frontend/.env', 'superadmin/.env'].map(p => path.join(root, p));
const digest = p => fs.existsSync(p) ? createHash('sha256').update(fs.readFileSync(p)).digest('hex') : null;
const envBefore = envPaths.map(digest);
const redact = s => s.replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, '[redacted database connection]');
const output = (name, data) => process.stdout.write('[' + name + '] ' + redact(data.toString()));

async function freePort(port) {
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', () => reject(new Error('Port ' + port + ' is occupied; existing process will not be stopped')));
    server.listen(port, '127.0.0.1', () => server.close(resolve));
  });
}

function launch(name, script, args, cwd, env) {
  const child = spawn(process.execPath, [script, ...args], { cwd, env, stdio: ['ignore','pipe','pipe'], windowsHide: true });
  children.push({ name, child });
  child.stdout.on('data', data => output(name, data));
  child.stderr.on('data', data => output(name, data));
  child.on('error', () => console.error(name + ' process could not start'));
  return child;
}

async function ready(url, child, timeout = 90000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error('Process exited before ready: ' + url);
    try { const response = await fetch(url, { signal: AbortSignal.timeout(3000) }); if (response.ok) return; } catch { /* startup in progress */ }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('Local process readiness timed out: ' + url);
}

async function stopChildren() {
  for (const { child } of [...children].reverse()) {
    if (child.exitCode !== null || !child.pid) continue;
    // Exact children owned by this runner only; never enumerate/kill another service.
    if (process.platform === 'win32') spawnSync('taskkill.exe', ['/PID',String(child.pid),'/T','/F'], { windowsHide: true, stdio: 'ignore' });
    else child.kill('SIGTERM');
  }
}

async function main() {
  const testUrl = process.env.SUPPORT_TEST_DATABASE_URL;
  if (!testUrl || process.env.SUPPORT_TEST_DATABASE_CONFIRM !== 'disposable') throw new Error('Explicit isolated test connection/confirmation missing');
  const url = new URL(testUrl);
  if (url.hostname.split('.')[0].replace(/-pooler$/, '') !== 'ep-orange-bird-b3hsltfm' || url.pathname !== '/neondb') throw new Error('Refusing an unverified database endpoint');
  for (const port of [4241,8181,8182]) await freePort(port);
  if (!fs.existsSync(path.join(backend, 'dist/app.module.js'))) throw new Error('Build the backend before acceptance');
  const prisma = new PrismaClient({ datasources: { db: { url: testUrl } } });
  try {
    const [identity, migrations] = await prisma.$transaction(async tx => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      const identity = await tx.$queryRawUnsafe("SELECT current_setting('neon.endpoint_id',true) AS endpoint,current_database() AS database");
      const migrations = await tx.$queryRawUnsafe(`SELECT count(*) FILTER(WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL)::int AS applied,count(*) FILTER(WHERE finished_at IS NULL AND rolled_back_at IS NULL)::int AS unfinished,max(checksum) FILTER(WHERE migration_name='20261105130000_support_phase2' AND finished_at IS NOT NULL AND rolled_back_at IS NULL) AS phase2 FROM "_prisma_migrations"`);
      return [identity[0],migrations[0]];
    });
    if (identity.endpoint !== 'ep-orange-bird-b3hsltfm' || identity.database !== 'neondb' || migrations.applied !== 44 || migrations.unfinished !== 0 || migrations.phase2 !== '54a8de0e7c1846840e05e6c65c3f6be2052b433fec5e71d803135915e4cb2f81') throw new Error('Isolated identity/migration preflight rejected');
    results.identity = identity; results.migrations = migrations;
    console.log('Verified support-integration-test endpoint=ep-orange-bird-b3hsltfm migrations=44');
  } finally { await prisma.$disconnect(); }

  const childEnv = { ...process.env, NODE_ENV: 'test', SUPPORT_LOCAL_NETWORK: '1', SUPPORT_LIVE_BROWSER: '1', JWT_SECRET: randomBytes(48).toString('hex'), PLATFORM_JWT_SECRET: randomBytes(48).toString('hex') };
  // The integration entry point independently rejects .env's shared URL, then sets BOTH URLs
  // to SUPPORT_TEST_DATABASE_URL before loading Nest or creating its Prisma service.
  delete childEnv.DATABASE_URL; delete childEnv.DIRECT_URL;
  const webEnv = { ...process.env, NODE_ENV: 'development', CI: '1', EXPO_OFFLINE: '1', EXPO_NO_DOTENV: '1', EXPO_NO_TELEMETRY: '1', BROWSER: 'none', EXPO_PUBLIC_API_URL: results.backend, EXPO_PUBLIC_PREVIEW_DATA: 'false' };
  delete webEnv.DATABASE_URL; delete webEnv.DIRECT_URL; delete webEnv.SUPPORT_TEST_DATABASE_URL;
  const business = launch('Business Expo', path.join(root,'frontend/node_modules/expo/bin/cli'), ['start','--web','--localhost','--port','8181'], path.join(root,'frontend'), webEnv);
  const superadmin = launch('SuperAdmin Expo', path.join(root,'superadmin/node_modules/expo/bin/cli'), ['start','--web','--localhost','--port','8182'], path.join(root,'superadmin'), webEnv);
  await Promise.all([ready(results.business,business),ready(results.superadmin,superadmin)]);
  results.frontendsReadyAt = new Date().toISOString();
  const test = launch('Isolated Nest/tests', path.join(backend,'test/support.integration.test.cjs'), [], backend, childEnv);
  // node:test also runs when its file is invoked directly, preserving its cleanup hooks.
  const completion = new Promise(resolve => { test.once('exit', code => resolve(code)); test.once('error', () => resolve(1)); });
  await ready(results.backend + '/health', test);
  results.backendReadyAt = new Date().toISOString();
  console.log('LOCAL_STACK_READY backend=4241 Business=8181 SuperAdmin=8182');
  const code = await completion;
  results.exitCode = code; results.status = code === 0 ? 'passed' : 'failed';
  if (code !== 0) process.exitCode = 1;
}

(async () => {
  try { await main(); }
  catch (error) { results.status = 'blocked-or-failed'; results.error = redact(error.message); console.error(results.error); process.exitCode = 1; }
  finally {
    await stopChildren();
    results.finishedAt = new Date().toISOString();
    results.environmentFilesUnchanged = envPaths.every((p,i) => digest(p) === envBefore[i]);
    results.temporaryProcessesStopped = true;
    fs.mkdirSync(path.join(backend,'dist'), { recursive: true });
    fs.writeFileSync(path.join(backend,'dist/support-local-acceptance-results.json'), JSON.stringify(results,null,2));
    console.log('LOCAL_ACCEPTANCE_RESULT ' + JSON.stringify(results));
  }
})();
