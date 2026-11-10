'use strict';
// Prisma CLI against Neon apk-testing, using backend/.env.
//
//   npm run prisma:apk -- migrate status
//   npm run prisma:apk -- migrate deploy
//
// Only these two commands are accepted. Migrations run over DIRECT_URL (not the
// pooler), as Prisma requires. prisma.config.cjs re-checks the target with the
// guard, so production and every other host are refused before Prisma connects.
// Connection strings are never printed.
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const dotenv = require('dotenv');
const guard = require('../safe-env/db-target-guard.cjs');

const backend = path.resolve(__dirname, '../..');
const fail = (code, detail) => {
  process.stderr.write(JSON.stringify({ event: 'refused', code, ...(detail ? { detail } : {}) }) + '\n');
  process.exit(2);
};

const args = process.argv.slice(2);
const command = args.filter(a => !a.startsWith('-')).slice(0, 2).join(' ');
if (!guard.REMOTE_PRISMA_COMMANDS.includes(command))
  fail('PRISMA_COMMAND_NOT_ALLOWED', 'only: ' + guard.REMOTE_PRISMA_COMMANDS.join(' | '));
if (args.some(a => /^[a-z]+:\/\//i.test(a) || a === '--url' || a.startsWith('--schema')))
  fail('PRISMA_ARGUMENT_REFUSED', 'URLs and schema overrides may not be passed');

let parsed;
try { parsed = dotenv.parse(fs.readFileSync(path.join(backend, '.env'))); }
catch { fail('ENV_FILE_MISSING', 'backend/.env'); }

const env = {};
for (const k of ['SystemRoot', 'WINDIR', 'COMSPEC', 'PATH', 'PATHEXT', 'TEMP', 'TMP', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA'])
  if (process.env[k] !== undefined) env[k] = process.env[k];
Object.assign(env, {
  NODE_ENV: 'development', // never production: the guard must stay enforced
  DATABASE_URL: parsed.DIRECT_URL || '', // migrations need the direct (non-pooled) endpoint
  DIRECT_URL: parsed.DIRECT_URL || '',
  PRISMA_HIDE_UPDATE_MESSAGE: '1',
  CHECKPOINT_DISABLE: '1',
});

try {
  const check = guard.assertSafeDatabaseTarget(env, { allowRemote: true });
  if (!check.remote) fail('NOT_APK_TESTING', 'backend/.env DIRECT_URL must be Neon apk-testing');
  if (check.target.pooled) fail('DIRECT_URL_IS_POOLED', 'DIRECT_URL must use the non-pooler host');
  process.stderr.write(JSON.stringify({ event: 'target', remote: check.remote, endpoint: check.target.endpoint, database: check.target.database, command }) + '\n');
} catch (e) {
  fail(e.code || 'GUARD_REFUSED', e.message);
}

const prisma = path.join(backend, 'node_modules/prisma/build/index.js');
const r = cp.spawnSync(process.execPath, [prisma, ...args], { cwd: backend, env, stdio: 'inherit', windowsHide: true });
process.exit(r.status ?? 1);
