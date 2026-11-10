"use strict";
// Fail-closed, development-only database target guard.
//
// Purpose: stop local backend runs, Prisma commands, seeds and tests from
// reaching a production (or any remote Neon) database through an inherited
// backend/.env. It allows exactly one kind of target: a loopback PostgreSQL
// database that carries an attestation written by attest-local-db.cjs and
// whose live server identity matches that attestation.
//
// Enforcement applies whenever NODE_ENV is not "production", or when the
// launcher sets BRANCHSUITE_FORCE_LOCAL_GUARD=1. A hosted production process
// (NODE_ENV=production) is not affected.
//
// Messages and errors never contain connection strings, passwords or user
// names. Endpoint identifiers (not secrets) may be named.
const fs = require("node:fs");
const path = require("node:path");

const PRODUCTION_ENDPOINTS = Object.freeze(["ep-autumn-sunset-b3sbfmer"]);
const KNOWN_REMOTE_ENDPOINTS = Object.freeze([
  "ep-late-sunset-b3cwjc8n", // apk-testing
  "ep-orange-bird-b3hsltfm", // support-integration-test (expired)
]);
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);
const ATTESTATION_KIND = "branchsuite-isolated-local-db";

class GuardRefusal extends Error {
  constructor(code, detail) {
    super(detail ? code + ": " + detail : code);
    this.name = "GuardRefusal";
    this.code = code;
  }
}
const refuse = (code, detail) => {
  throw new GuardRefusal(code, detail);
};

function enforcementRequired(env = process.env) {
  return (
    env.NODE_ENV !== "production" || env.BRANCHSUITE_FORCE_LOCAL_GUARD === "1"
  );
}

// Returns a sanitized description of a connection URL, or throws.
function classifyUrl(raw, label) {
  if (typeof raw !== "string" || raw.trim() === "")
    refuse("DATABASE_TARGET_MISSING", label + " is not set");
  let u;
  try {
    u = new URL(raw.trim());
  } catch {
    refuse("DATABASE_TARGET_UNPARSEABLE", label + " is not a valid URL");
  }
  if (!["postgresql:", "postgres:"].includes(u.protocol))
    refuse("DATABASE_TARGET_UNKNOWN", label + " is not a PostgreSQL URL");
  const host = u.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  const endpoint = host.split(".")[0].replace(/-pooler$/, "");
  if (PRODUCTION_ENDPOINTS.includes(endpoint))
    refuse(
      "PRODUCTION_ENDPOINT_REFUSED",
      label + " targets the production endpoint " + endpoint,
    );
  if (KNOWN_REMOTE_ENDPOINTS.includes(endpoint))
    refuse(
      "REMOTE_ENDPOINT_REFUSED",
      label + " targets the remote Neon endpoint " + endpoint,
    );
  if (!LOOPBACK_HOSTS.has(host))
    refuse(
      "REMOTE_DATABASE_REFUSED",
      label + " host is not loopback (remote and unknown hosts are refused)",
    );
  for (const k of ["host", "hostaddr", "service", "options", "pgbouncer"])
    if (u.searchParams.has(k))
      refuse("DATABASE_TARGET_AMBIGUOUS", label + " carries a " + k + " override");
  const database = decodeURIComponent(u.pathname.replace(/^\//, ""));
  if (!database || database.includes("/"))
    refuse("DATABASE_TARGET_AMBIGUOUS", label + " has no single database name");
  if (!u.port || !/^\d+$/.test(u.port))
    refuse("DATABASE_TARGET_AMBIGUOUS", label + " must name an explicit port");
  return {
    host: host === "localhost" ? "127.0.0.1" : host,
    port: Number(u.port),
    database,
    user: decodeURIComponent(u.username),
  };
}

function readAttestation(file) {
  if (!file) refuse("ATTESTATION_REQUIRED", "BRANCHSUITE_LOCAL_DB_ATTESTATION is not set");
  let a;
  try {
    a = JSON.parse(fs.readFileSync(path.resolve(file), "utf8"));
  } catch {
    refuse("ATTESTATION_UNREADABLE", "attestation file missing or invalid");
  }
  if (
    !a ||
    a.kind !== ATTESTATION_KIND ||
    a.version !== 1 ||
    !LOOPBACK_HOSTS.has(a.host) ||
    !Number.isInteger(a.port) ||
    !a.database ||
    !a.user ||
    !/^\d{10,}$/.test(String(a.systemIdentifier)) ||
    !a.dataDirectory ||
    a.notNeon !== true
  )
    refuse("ATTESTATION_INVALID", "attestation is incomplete or of the wrong kind");
  return a;
}

// Static (pre-connection) check. Throws GuardRefusal; returns a summary.
function assertSafeDatabaseTarget(env = process.env) {
  if (!enforcementRequired(env)) return { enforced: false };
  const primary = classifyUrl(env.DATABASE_URL, "DATABASE_URL");
  if (env.DIRECT_URL !== undefined && env.DIRECT_URL !== "") {
    const direct = classifyUrl(env.DIRECT_URL, "DIRECT_URL");
    if (JSON.stringify(direct) !== JSON.stringify(primary))
      refuse("DATABASE_TARGET_AMBIGUOUS", "DATABASE_URL and DIRECT_URL differ");
  }
  const attestation = readAttestation(env.BRANCHSUITE_LOCAL_DB_ATTESTATION);
  const same =
    attestation.host === primary.host &&
    attestation.port === primary.port &&
    attestation.database === primary.database &&
    attestation.user === primary.user;
  if (!same)
    refuse("ATTESTATION_MISMATCH", "the URL does not match the attested database");
  return { enforced: true, attestation, target: primary };
}

// Live identity check against the attestation. `row` comes from
// LIVE_IDENTITY_SQL executed on the connection about to be used.
const LIVE_IDENTITY_SQL =
  "SELECT current_database() AS database, host(inet_server_addr()) AS address, inet_server_port() AS port, current_setting('data_directory') AS data_directory, current_setting('neon.endpoint_id', true) AS neon_endpoint, (SELECT system_identifier::text FROM pg_control_system()) AS system_identifier";
function assertLiveIdentity(row, attestation) {
  const norm = (p) => path.resolve(String(p)).toLowerCase();
  if (!row) refuse("LIVE_IDENTITY_UNAVAILABLE", "no identity row");
  if (row.neon_endpoint) refuse("LIVE_IDENTITY_MISMATCH", "server reports a Neon endpoint");
  if (
    row.database !== attestation.database ||
    !LOOPBACK_HOSTS.has(String(row.address)) ||
    Number(row.port) !== attestation.port ||
    String(row.system_identifier) !== String(attestation.systemIdentifier) ||
    norm(row.data_directory) !== norm(attestation.dataDirectory)
  )
    refuse("LIVE_IDENTITY_MISMATCH", "server identity differs from the attestation");
  return true;
}

// Static check plus live identity check using a Prisma-style client.
async function assertSafeTargetWithClient(client, env = process.env) {
  const check = assertSafeDatabaseTarget(env);
  if (!check.enforced) return check;
  const rows = await client.$queryRawUnsafe(LIVE_IDENTITY_SQL);
  assertLiveIdentity(rows[0], check.attestation);
  return check;
}

module.exports = {
  PRODUCTION_ENDPOINTS,
  KNOWN_REMOTE_ENDPOINTS,
  ATTESTATION_KIND,
  GuardRefusal,
  enforcementRequired,
  classifyUrl,
  readAttestation,
  assertSafeDatabaseTarget,
  assertLiveIdentity,
  assertSafeTargetWithClient,
  LIVE_IDENTITY_SQL,
};
