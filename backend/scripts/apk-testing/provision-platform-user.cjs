'use strict';
// Narrow SuperAdmin account provisioning for Neon apk-testing ONLY.
//
//   Plan (default, read-only):
//     node scripts/apk-testing/provision-platform-user.cjs --role admin --mode create
//   Execute (writes ONE PlatformUser row, requires every flag):
//     node scripts/apk-testing/provision-platform-user.cjs --role admin --mode create --execute \
//       --confirm-target ep-late-sunset-b3cwjc8n --approval "<who approved, ticket/ref>" \
//       --backup-file <pg_dump taken < 6 h ago>
//
// Modes:
//   create          Insert the account if its email is absent. An existing account is NEVER
//                   modified (safe to retry: second run is a no-op).
//   reset-password  Re-hash the password of an existing account and increment tokenVersion
//                   (signs out every existing session). Role/status are not changed. No-op if
//                   the password already matches.
//
// Email/password/name come only from backend/.env SEED_PLATFORM_<ADMIN|SUPPORT>_*; passwords
// are never accepted on the command line. Uses bcrypt cost 12 (application work factor).
// Touches only the single PlatformUser row selected by email. No RBAC/business tables.
// Never prints or records passwords, hashes, tokens or connection strings.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');

const backend = path.resolve(__dirname, '../..');
const guard = require('../safe-env/db-target-guard.cjs');

const BCRYPT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 12;
const REQUIRED_MIGRATIONS = 44;
const BACKUP_MAX_AGE_MS = 6 * 60 * 60 * 1000;
const ROLES = Object.freeze({
  admin: { prefix: 'SEED_PLATFORM_ADMIN', role: 'PLATFORM_ADMIN', defaultName: 'Platform Admin' },
  support: { prefix: 'SEED_PLATFORM_SUPPORT', role: 'PLATFORM_SUPPORT', defaultName: 'Platform Support' },
});
const DEFAULT_AUDIT_FILE = path.join(os.homedir(), '.branchsuite-release', 'platform-user-provisioning.jsonl');

class Refusal extends Error {
  constructor(code, detail) { super(detail ? code + ': ' + detail : code); this.code = code; }
}
const refuse = (code, detail) => { throw new Refusal(code, detail); };
const maskEmail = e => { const [u, d] = String(e).split('@'); return (u || '').slice(0, 2) + '***@' + (d || '?'); };

function parseArgs(argv) {
  const o = { execute: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => { if (i + 1 >= argv.length) refuse('ARGUMENT_VALUE_MISSING', a); return argv[++i]; };
    if (a === '--role') o.role = val();
    else if (a === '--mode') o.mode = val();
    else if (a === '--execute') o.execute = true;
    else if (a === '--confirm-target') o.confirmTarget = val();
    else if (a === '--approval') o.approval = val();
    else if (a === '--backup-file') o.backupFile = val();
    else if (/password|secret|url/i.test(a) || /^[a-z]+:\/\//i.test(a)) refuse('SECRET_ARGUMENT_REFUSED', 'credentials come only from backend/.env');
    else refuse('UNKNOWN_ARGUMENT', a);
  }
  if (!ROLES[o.role]) refuse('ROLE_REQUIRED', '--role admin|support');
  if (!['create', 'reset-password'].includes(o.mode)) refuse('MODE_REQUIRED', '--mode create|reset-password');
  if (o.execute) {
    if (o.confirmTarget !== guard.APPROVED_REMOTE.endpoint) refuse('TARGET_CONFIRMATION_REQUIRED', '--confirm-target ' + guard.APPROVED_REMOTE.endpoint);
    if (!o.approval || o.approval.trim().length < 3) refuse('APPROVAL_REFERENCE_REQUIRED', '--approval "<approver/reference>"');
    if (!o.backupFile) refuse('BACKUP_REQUIRED', '--backup-file <recent pg_dump>');
  }
  return o;
}

// Credentials for the chosen role from parsed backend/.env values.
function accountInput(parsedEnv, roleKey) {
  const r = ROLES[roleKey];
  const rawEmail = parsedEnv[r.prefix + '_EMAIL'];
  const password = parsedEnv[r.prefix + '_PASSWORD'];
  const email = rawEmail?.trim().toLowerCase(); // login lower-cases before lookup
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) refuse('EMAIL_REQUIRED', r.prefix + '_EMAIL in backend/.env');
  if (!password) refuse('PASSWORD_REQUIRED', r.prefix + '_PASSWORD in backend/.env');
  if (password.length < MIN_PASSWORD_LENGTH || password.length > 128) refuse('PASSWORD_LENGTH', `${MIN_PASSWORD_LENGTH}-128 characters`);
  return { email, password, name: parsedEnv[r.prefix + '_NAME']?.trim() || r.defaultName, role: r.role };
}

// Pure decision: what would happen to the single row for this email.
async function planAction(existing, input, mode, compare) {
  if (mode === 'create') {
    if (existing) return { action: 'NOOP_ALREADY_EXISTS', note: existing.role !== input.role || existing.status !== 'ACTIVE'
      ? `existing account has role ${existing.role} / status ${existing.status}; not modified` : undefined };
    return { action: 'CREATE' };
  }
  if (!existing) return { action: 'REFUSE_NOT_FOUND' };
  if (await compare(input.password, existing.passwordHash)) return { action: 'NOOP_PASSWORD_UNCHANGED' };
  return { action: 'RESET_PASSWORD', note: existing.status !== 'ACTIVE' ? `status remains ${existing.status}` : undefined };
}

// Preconditions checked on the SAME connection/transaction that would write.
async function verifyDatabase(tx) {
  const id = await tx.$queryRawUnsafe(guard.REMOTE_IDENTITY_SQL);
  guard.assertRemoteIdentity(id[0]);
  const [ledger] = await tx.$queryRawUnsafe(
    `SELECT count(*) FILTER (WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL)::int AS finished,
            count(*) FILTER (WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL)::int AS unfinished
       FROM _prisma_migrations`);
  if (ledger.finished !== REQUIRED_MIGRATIONS || ledger.unfinished !== 0)
    refuse('SCHEMA_NOT_READY', `${ledger.finished}/${REQUIRED_MIGRATIONS} finished, ${ledger.unfinished} unfinished`);
  const cols = (await tx.$queryRawUnsafe(
    `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='PlatformUser'`)).map(r => r.column_name);
  for (const c of ['id', 'name', 'email', 'passwordHash', 'role', 'status', 'tokenVersion', 'createdAt', 'updatedAt'])
    if (!cols.includes(c)) refuse('SCHEMA_NOT_READY', 'PlatformUser.' + c + ' missing');
  return { endpoint: id[0].neon_endpoint, migrations: ledger.finished };
}

// Executes inside one serializable transaction; affects at most one row, verified by counts.
async function applyAction(tx, input, mode, { hash, compare }) {
  await tx.$executeRawUnsafe('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');
  const db = await verifyDatabase(tx);
  const before = await tx.platformUser.count();
  const existing = await tx.platformUser.findUnique({ where: { email: input.email } });
  const tokenVersionBefore = existing ? existing.tokenVersion : null; // snapshot before any write
  const plan = await planAction(existing, input, mode, compare);
  let row = existing;
  if (plan.action === 'CREATE') {
    row = await tx.platformUser.create({ data: { name: input.name, email: input.email, role: input.role, status: 'ACTIVE',
      passwordHash: await hash(input.password, BCRYPT_ROUNDS) } });
  } else if (plan.action === 'RESET_PASSWORD') {
    row = await tx.platformUser.update({ where: { id: existing.id },
      data: { passwordHash: await hash(input.password, BCRYPT_ROUNDS), tokenVersion: { increment: 1 } } });
  } else if (plan.action === 'REFUSE_NOT_FOUND') refuse('ACCOUNT_NOT_FOUND', 'use --mode create');
  const after = await tx.platformUser.count();
  if (after !== before + (plan.action === 'CREATE' ? 1 : 0)) refuse('UNEXPECTED_ROW_COUNT', `${before} -> ${after}`);
  return { ...db, ...plan, userId: row?.id, role: row?.role, status: row?.status,
    tokenVersionBefore, tokenVersionAfter: row?.tokenVersion ?? null, platformUsersBefore: before, platformUsersAfter: after };
}

function checkBackup(file, now = Date.now()) {
  let st;
  try { st = fs.statSync(file); } catch { refuse('BACKUP_NOT_FOUND', file); }
  if (!st.isFile() || st.size < 1024) refuse('BACKUP_INVALID', 'too small or not a file');
  if (now - st.mtimeMs > BACKUP_MAX_AGE_MS) refuse('BACKUP_TOO_OLD', 'take a fresh pg_dump (< 6 h)');
  const list = cp.spawnSync(process.env.BRANCHSUITE_PG_RESTORE || 'C:/Program Files/PostgreSQL/18/bin/pg_restore.exe', ['--list', file], { encoding: 'utf8', windowsHide: true });
  if (list.status !== 0 || !/TABLE DATA public "?PlatformUser"?/.test(list.stdout)) refuse('BACKUP_UNREADABLE', 'pg_restore --list failed or PlatformUser data missing');
  return { file, bytes: st.size, sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') };
}

function writeAudit(record, file = DEFAULT_AUDIT_FILE) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, JSON.stringify(record) + '\n', { mode: 0o600 });
}

async function main(argv = process.argv.slice(2)) {
  const opts = parseArgs(argv);
  const dotenv = require('dotenv');
  const parsed = dotenv.parse(fs.readFileSync(path.join(backend, '.env')));
  const input = accountInput(parsed, opts.role);
  const url = parsed.DIRECT_URL || parsed.DATABASE_URL;
  const check = guard.assertSafeDatabaseTarget({ NODE_ENV: 'development', DATABASE_URL: url }, { allowRemote: true });
  if (check.remote !== 'apk-testing') refuse('NOT_APK_TESTING');
  const backup = opts.execute ? checkBackup(opts.backupFile) : null;

  const bcrypt = require('bcrypt');
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  const base = { at: new Date().toISOString(), operator: os.userInfo().username, host: os.hostname(), approval: opts.approval ?? null,
    mode: opts.mode, roleRequested: input.role, email: maskEmail(input.email), backup };
  try {
    let result;
    if (!opts.execute) {
      result = await prisma.$transaction(async tx => {
        await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
        const db = await verifyDatabase(tx);
        const existing = await tx.platformUser.findUnique({ where: { email: input.email } });
        return { ...db, ...(await planAction(existing, input, opts.mode, bcrypt.compare)), dryRun: true };
      });
      console.log(JSON.stringify({ ...base, ...result, next: 'rerun with --execute --confirm-target --approval --backup-file to apply' }, null, 2));
      return result;
    }
    try {
      result = await prisma.$transaction(tx => applyAction(tx, input, opts.mode, { hash: bcrypt.hash, compare: bcrypt.compare }), { timeout: 30000 });
    } catch (e) {
      writeAudit({ ...base, outcome: 'FAILED', code: e.code || 'ERROR' });
      throw e;
    }
    writeAudit({ ...base, outcome: 'OK', ...result });
    console.log(JSON.stringify({ ...base, outcome: 'OK', ...result, auditFile: DEFAULT_AUDIT_FILE }, null, 2));
    return result;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module)
  main().catch(e => {
    process.stderr.write(JSON.stringify({ event: 'refused', code: e.code || 'ERROR',
      detail: String(e.message).replace(/postgres(ql)?:\/\/\S+/gi, '[REDACTED]').replace(/\$2[aby]\$\d\d\$\S+/g, '[REDACTED]').slice(0, 300) }) + '\n');
    process.exit(2);
  });

module.exports = { parseArgs, accountInput, planAction, verifyDatabase, applyAction, checkBackup, writeAudit, maskEmail, BCRYPT_ROUNDS, ROLES };
