'use strict';
// Separate preparation policy, NOT a replacement for safe-env/db-target-guard.
// No network calls, secret resolution, backend spawn or migration execution.
const plan = require('./development-plan.json');
const production = 'ep-autumn-sunset-b3sbfmer';
const fail = code => { throw Object.assign(new Error(code), {code}); };

function assertIdentity(metadata, sql) {
  const t = plan.target;
  if (!metadata || metadata.projectId !== t.projectId || metadata.branchId !== t.branchId ||
      metadata.branchName !== t.branchName || metadata.endpointId !== t.endpointId ||
      metadata.host !== t.directHost || metadata.primary !== false || metadata.default !== false)
    fail('APK_METADATA_REFUSED');
  if (!sql || sql.endpoint !== t.endpointId || sql.database !== t.database ||
      sql.schema !== t.schema || sql.read_only !== 'on') fail('APK_SQL_IDENTITY_REFUSED');
  return true;
}

// Pure validation only. Callers must supply credentials through an approved private
// resolver later; this module never reads backend/.env or inherited DATABASE_URL.
function validatePrivateUrl(raw, kind) {
  if (!raw) fail('PRIVATE_CREDENTIAL_REQUIRED');
  let u;
  try { u = new URL(raw); } catch { fail('DATABASE_URL_REFUSED'); }
  const endpoint = u.hostname.split('.')[0].replace(/-pooler$/, '');
  if (endpoint === production) fail('PRODUCTION_ENDPOINT_REFUSED');
  if (!['direct','pooled'].includes(kind)) fail('CONNECTION_KIND_REQUIRED');
  const expectedHost = kind === 'direct' ? plan.target.directHost : plan.target.pooledHost;
  if (u.protocol !== 'postgresql:' || u.hostname !== expectedHost ||
      !['','5432'].includes(u.port) || u.pathname !== '/neondb' || u.hash ||
      !u.username || !u.password) fail('APK_CONNECTION_TARGET_REFUSED');
  for (const name of u.searchParams.keys()) {
    if (!['schema','sslmode','sslaccept','sslcert','connect_timeout','pool_timeout','connection_limit'].includes(name) ||
        u.searchParams.getAll(name).length !== 1) fail('DATABASE_OPTIONS_REFUSED');
  }
  if (u.searchParams.get('schema') !== 'public' || u.searchParams.get('sslmode') !== 'require' ||
      u.searchParams.get('sslaccept') !== 'strict') fail('STRICT_TLS_AND_SCHEMA_REQUIRED');
  return {host:u.hostname,database:'neondb',schema:'public',kind,tlsPolicy:'require/strict'};
}

function frontendEnvironment(lanAddresses) {
  if (!Array.isArray(lanAddresses) || !lanAddresses.includes(plan.frontend.verifiedLanAddress))
    fail('LAN_IDENTITY_CHANGED');
  return {EXPO_PUBLIC_API_URL:plan.frontend.EXPO_PUBLIC_API_URL,
    EXPO_NO_DOTENV:'1',EXPO_PUBLIC_PREVIEW_DATA:'false'};
}

function refuseBackendStart() {
  // Intentionally no environment variable, approval JSON or flag can unlock this
  // preparation module. Actual runtime integration requires a separately reviewed change.
  fail('APK_BACKEND_EXECUTION_NOT_IMPLEMENTED_OR_AUTHORIZED');
}

// Variables that could silently redirect the backend or Prisma to another database,
// or reload backend/.env. The APK path refuses to start if the shell already sets them.
const INHERITED_DATABASE_KEYS = Object.freeze([
  'DATABASE_URL','DIRECT_URL','SHADOW_DATABASE_URL','DOTENV_CONFIG_PATH','DOTENV_CONFIG_OVERRIDE',
  'PGHOST','PGHOSTADDR','PGPORT','PGDATABASE','PGUSER','PGPASSWORD','PGSERVICE','PGSERVICEFILE',
  'BRANCHSUITE_LOCAL_DB_ATTESTATION','BRANCHSUITE_FORCE_LOCAL_GUARD']);

function assertCleanInheritedEnvironment(env) {
  if (!env || typeof env !== 'object') fail('INHERITED_ENVIRONMENT_REQUIRED');
  if (env.NODE_ENV !== undefined && env.NODE_ENV !== '' && env.NODE_ENV !== 'development')
    fail('NODE_ENV_OVERRIDE_REFUSED');
  const found = INHERITED_DATABASE_KEYS.filter(k => env[k] !== undefined && env[k] !== '');
  if (found.length) {
    // Names only; values may be secrets and are never echoed.
    const e = Object.assign(new Error('INHERITED_DATABASE_OVERRIDE_REFUSED'),
      {code:'INHERITED_DATABASE_OVERRIDE_REFUSED', keys:found});
    throw e;
  }
  return true;
}

// Separate restricted runtime credentials: the application (pooled) role must differ
// from the migration/direct role, and the two JWT secrets must be distinct and strong.
function validateRuntimeSecrets(secrets) {
  if (!secrets || typeof secrets !== 'object') fail('PRIVATE_CREDENTIAL_REQUIRED');
  validatePrivateUrl(secrets.applicationDatabaseUrl, 'pooled');
  validatePrivateUrl(secrets.directDatabaseUrl, 'direct');
  const appUser = new URL(secrets.applicationDatabaseUrl).username;
  const directUser = new URL(secrets.directDatabaseUrl).username;
  if (appUser === directUser) fail('APPLICATION_ROLE_MUST_DIFFER_FROM_MIGRATION_ROLE');
  for (const k of ['businessJwtSecret','platformJwtSecret'])
    if (typeof secrets[k] !== 'string' || secrets[k].length < 32) fail('JWT_SECRET_REQUIRED');
  if (secrets.businessJwtSecret === secrets.platformJwtSecret) fail('JWT_SECRETS_MUST_DIFFER');
  return true;
}

const BASE_KEYS = ['SystemRoot','WINDIR','COMSPEC','PATH','PATHEXT','TEMP','TMP','USERPROFILE',
  'APPDATA','LOCALAPPDATA','HOMEDRIVE','HOMEPATH','NUMBER_OF_PROCESSORS','PROCESSOR_ARCHITECTURE','OS'];
const NO_DOTENV_FILE = require('node:path').join(__dirname, 'no-dotenv.env');

// Pure: builds the minimal child environment for the FUTURE approved APK backend.
// Nothing calls this with real secrets yet; the secret resolver is not provisioned.
function buildChildEnvironment(inherited, secrets, {bindAddress = plan.backend.defaultBindAddress, lanExposureApproved = false} = {}) {
  assertCleanInheritedEnvironment(inherited);
  validateRuntimeSecrets(secrets);
  if (bindAddress !== '127.0.0.1') {
    if (bindAddress !== plan.frontend.verifiedLanAddress || lanExposureApproved !== true)
      fail('LAN_EXPOSURE_NOT_APPROVED');
  }
  const env = {};
  for (const k of BASE_KEYS) if (inherited[k] !== undefined) env[k] = inherited[k];
  return Object.assign(env, {
    NODE_ENV: 'development',
    PORT: plan.backend.PORT,
    HOST: bindAddress,
    BRANCHSUITE_DB_ACCESS_POLICY: 'apk-testing',
    DATABASE_URL: secrets.applicationDatabaseUrl, // restricted pooled role; no DIRECT_URL at runtime
    JWT_SECRET: secrets.businessJwtSecret,
    PLATFORM_JWT_SECRET: secrets.platformJwtSecret,
    CORS_ORIGIN: plan.backend.corsOrigins.join(','),
    DOTENV_CONFIG_PATH: NO_DOTENV_FILE, // `dotenv/config` must not fall back to backend/.env
    SMTP_HOST: '127.0.0.1', SMTP_PORT: '9', SMTP_USER: 'apk-disabled', SMTP_PASS: 'apk-disabled',
    SMTP_FROM: 'apk-disabled@invalid.test',
    PRISMA_HIDE_UPDATE_MESSAGE: '1', CHECKPOINT_DISABLE: '1',
  });
}

// Returns every unsatisfied runtime gate. Missing evidence counts as unsatisfied.
function evaluateRuntimeGates(g) {
  g = g || {};
  const blockers = [];
  if (g.appliedMigrations !== g.requiredMigrations || g.requiredMigrations !== 44)
    blockers.push(`SCHEMA_INCOMPATIBLE: ${g.appliedMigrations ?? '?'}/44 migrations applied`);
  if (g.unfinishedMigrations !== 0) blockers.push('UNFINISHED_MIGRATIONS_PRESENT_OR_UNKNOWN');
  for (const [key, code] of [
    ['schemaPostflightPassed','SCHEMA_POSTFLIGHT_NOT_PASSED'],
    ['credentialsRotated','PREVIOUSLY_SHARED_CREDENTIALS_NOT_ROTATED'],
    ['secretResolverProvisioned','PRIVATE_SECRET_RESOLVER_NOT_PROVISIONED'],
    ['restrictedApplicationRole','RESTRICTED_APPLICATION_ROLE_MISSING'],
    ['privateTlsVerified','AUTHENTICATED_TLS_NOT_VERIFIED'],
    ['ownerAccessApproval','APK_OWNER_ACCESS_APPROVAL_MISSING'],
    ['writerCoordination','WRITER_COORDINATION_MISSING'],
    ['prismaServiceIntegrationReviewed','PRISMA_SERVICE_APK_POLICY_NOT_INTEGRATED']])
    if (g[key] !== true) blockers.push(code);
  return {ready: blockers.length === 0, blockers};
}

module.exports = {assertIdentity,validatePrivateUrl,frontendEnvironment,refuseBackendStart,
  INHERITED_DATABASE_KEYS,assertCleanInheritedEnvironment,validateRuntimeSecrets,
  buildChildEnvironment,evaluateRuntimeGates,NO_DOTENV_FILE};
