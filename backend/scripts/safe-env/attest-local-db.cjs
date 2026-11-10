"use strict";
// Writes an attestation for an isolated LOOPBACK PostgreSQL database.
//
//   node scripts/safe-env/attest-local-db.cjs --env-file .env.local-integration \
//        --out <attestation.json> --confirm-isolated-local
//
// It reads DATABASE_URL from an approved env file, refuses anything that is not
// a loopback URL, connects read-only with psql, records the live server
// identity, and refuses a server that reports a Neon endpoint. The operator
// asserts isolation with --confirm-isolated-local; nothing here can prove it
// beyond identity, so the confirmation is deliberate and explicit.
const fs = require("node:fs");
const path = require("node:path");
const cp = require("node:child_process");
const dotenv = require("dotenv");
const guard = require("./db-target-guard.cjs");

const backend = path.resolve(__dirname, "../..");
const args = process.argv.slice(2);
const opt = (n) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : undefined;
};
const fail = (code, detail) => {
  process.stderr.write(JSON.stringify({ event: "refused", code, ...(detail ? { detail } : {}) }) + "\n");
  process.exit(2);
};
const psqlPath = () =>
  process.env.BRANCHSUITE_PSQL ||
  (fs.existsSync("C:/Program Files/PostgreSQL/18/bin/psql.exe")
    ? "C:/Program Files/PostgreSQL/18/bin/psql.exe"
    : "psql");

function attest({ envFile, out, confirmed }) {
  if (!confirmed) fail("CONFIRMATION_REQUIRED", "pass --confirm-isolated-local");
  if (!out) fail("OUTPUT_REQUIRED", "pass --out <attestation.json>");
  const file = path.resolve(envFile);
  if (path.dirname(file) !== backend || !/^\.env\.local-integration[\w.-]*$/.test(path.basename(file)))
    fail("ENV_FILE_NOT_APPROVED");
  const env = dotenv.parse(fs.readFileSync(file));
  let target;
  try {
    target = guard.classifyUrl(env.DATABASE_URL, "DATABASE_URL");
  } catch (e) {
    fail(e.code, e.message);
  }
  const u = new URL(env.DATABASE_URL);
  const r = cp.spawnSync(
    psqlPath(),
    ["-X", "-q", "-A", "-t", "-w", "-h", target.host, "-p", String(target.port), "-U", target.user, "-d", target.database, "-c",
      "BEGIN READ ONLY; SELECT json_build_object('i',(" + guard.LIVE_IDENTITY_SQL.replace(/;$/, "").replace(/^SELECT /, "SELECT row_to_json(x) FROM (SELECT ") + ") x),'v',current_setting('server_version_num')::int)::text; ROLLBACK;"],
    { env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, PGPASSWORD: decodeURIComponent(u.password), PGSSLMODE: "disable", PGCONNECT_TIMEOUT: "5" }, encoding: "utf8", timeout: 20000, windowsHide: true },
  );
  if (r.error || r.status !== 0) fail("ATTEST_CONNECTION_FAILED", "could not read the local database identity");
  const row = r.stdout.trim().split(/\r?\n/).filter((l) => l.startsWith("{")).map(JSON.parse)[0];
  if (!row) fail("ATTEST_IDENTITY_UNREADABLE");
  const id = row.i;
  if (id.neon_endpoint) fail("ATTEST_NEON_REFUSED", "server reports a Neon endpoint");
  if (!["127.0.0.1", "::1"].includes(id.address) || Number(id.port) !== target.port || id.database !== target.database)
    fail("ATTEST_IDENTITY_MISMATCH");
  const attestation = {
    kind: guard.ATTESTATION_KIND,
    version: 1,
    host: target.host,
    port: target.port,
    database: target.database,
    user: target.user,
    systemIdentifier: String(id.system_identifier),
    dataDirectory: String(id.data_directory),
    serverVersionNum: row.v,
    notNeon: true,
    attestedAt: new Date().toISOString(),
    attestedBy: "operator via attest-local-db.cjs --confirm-isolated-local",
  };
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(path.resolve(out), JSON.stringify(attestation, null, 2) + "\n", { flag: "wx" });
  return attestation;
}

module.exports = { attest };
if (require.main === module) {
  const a = attest({ envFile: opt("--env-file") || ".env.local-integration", out: opt("--out"), confirmed: args.includes("--confirm-isolated-local") });
  process.stdout.write(JSON.stringify({ event: "attested", database: a.database, port: a.port, systemIdentifier: a.systemIdentifier }) + "\n");
}
