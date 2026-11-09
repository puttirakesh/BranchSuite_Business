"use strict";
// Approved safe launcher for local development.
//
//   node scripts/safe-env/run.cjs [--env-file <file>] <task> [args...]
//   npm run safe -- <task> [args...]
//
// Tasks:  start | start:dev | build | test [files...] | seed | exec <local-integration script> | prisma <args...> | check
//
// It loads ONLY one approved env file (default backend/.env.local-integration,
// never backend/.env or its backups), builds a minimal child environment,
// neutralizes email delivery, runs the database target guard, and only then
// starts the command. No production or remote database can pass the guard.
const fs = require("node:fs");
const path = require("node:path");
const cp = require("node:child_process");
const dotenv = require("dotenv");
const guard = require("./db-target-guard.cjs");

const backend = path.resolve(__dirname, "../..");
const BASE = [
  "SystemRoot", "WINDIR", "COMSPEC", "PATH", "PATHEXT", "TEMP", "TMP",
  "USERPROFILE", "APPDATA", "LOCALAPPDATA", "HOMEDRIVE", "HOMEPATH",
  "NUMBER_OF_PROCESSORS", "PROCESSOR_ARCHITECTURE", "OS",
];
const fail = (code, detail) => {
  process.stderr.write(
    JSON.stringify({ event: "refused", code, ...(detail ? { detail } : {}) }) + "\n",
  );
  process.exit(2);
};

function approvedEnvFile(arg) {
  const file = path.resolve(arg || path.join(backend, ".env.local-integration"));
  const name = path.basename(file);
  if (
    path.dirname(file) !== backend ||
    !/^\.env\.local-integration[\w.-]*$/.test(name)
  )
    fail("ENV_FILE_NOT_APPROVED", "only backend/.env.local-integration* is accepted");
  if (!fs.existsSync(file))
    fail("ENV_FILE_MISSING", "run local-integration/setup.cjs first");
  return file;
}

function buildEnv(file, task) {
  const parsed = dotenv.parse(fs.readFileSync(file));
  const env = {};
  for (const k of BASE) if (process.env[k] !== undefined) env[k] = process.env[k];
  // Opt-in test switches (RUN_APP_INTEGRATION=1, ...) are the only pass-through.
  for (const k of Object.keys(process.env))
    if (/^RUN_[A-Z0-9_]+$/.test(k)) env[k] = process.env[k];
  Object.assign(env, parsed);
  Object.assign(env, {
    NODE_ENV: task === "test" ? "test" : parsed.NODE_ENV || "development",
    BRANCHSUITE_FORCE_LOCAL_GUARD: "1",
    DOTENV_CONFIG_PATH: file, // `dotenv/config` loads this file, not backend/.env
    // Email delivery is disabled: connections go to a closed loopback port.
    SMTP_HOST: "127.0.0.1",
    SMTP_PORT: "9",
    SMTP_USER: "local-disabled",
    SMTP_PASS: "local-disabled",
    SMTP_FROM: "local-disabled@invalid.test",
    PRISMA_HIDE_UPDATE_MESSAGE: "1",
    CHECKPOINT_DISABLE: "1",
  });
  delete env.DEV_OTP_TO_SENDER;
  return env;
}

function command(task, args) {
  const node = process.execPath;
  const nest = path.join(backend, "node_modules/@nestjs/cli/bin/nest.js");
  const prisma = path.join(backend, "node_modules/prisma/build/index.js");
  switch (task) {
    case "start": return [node, [nest, "start"]];
    case "start:dev": return [node, [nest, "start", "--watch"]];
    case "build": return [node, [nest, "build"]];
    case "exec": {
      // Only scripts that live in the repository's local-integration folder.
      const script = path.resolve(backend, args[0] || "");
      const allowed = path.join(path.dirname(backend), "local-integration") + path.sep;
      if (!args[0] || !script.startsWith(allowed) || !fs.existsSync(script))
        fail("EXEC_SCRIPT_NOT_APPROVED", "only local-integration/* scripts may be executed");
      return [node, [script, ...args.slice(1)]];
    }
    case "seed": return [node, ["-r", "ts-node/register/transpile-only", "prisma/seed.ts"]];
    case "test":
      return [node, ["-r", "ts-node/register/transpile-only", "--test", ...(args.length ? args : fs.readdirSync(path.join(backend, "test")).filter((f) => f.endsWith(".test.cjs")).map((f) => "test/" + f))]];
    case "prisma":
      if (args.some((a) => /^[a-z]+:\/\//i.test(a) || a === "--url"))
        fail("PRISMA_URL_ARGUMENT_REFUSED", "connection URLs may not be passed on the command line");
      return [node, [prisma, ...args]];
    default:
      return null;
  }
}

function main() {
  const argv = process.argv.slice(2);
  let envArg;
  if (argv[0] === "--env-file") envArg = (argv.shift(), argv.shift());
  const task = argv.shift();
  if (!task) fail("TASK_REQUIRED", "start | start:dev | build | test | seed | prisma | check");
  const file = approvedEnvFile(envArg);
  const env = buildEnv(file, task);
  let check;
  try {
    check = guard.assertSafeDatabaseTarget(env);
  } catch (e) {
    fail(e.code || "GUARD_REFUSED", e.message);
  }
  if (task === "check") {
    process.stdout.write(JSON.stringify({ event: "target-verified", enforced: check.enforced, host: check.target.host, port: check.target.port, database: check.target.database, systemIdentifier: String(check.attestation.systemIdentifier) }) + "\n");
    return;
  }
  const spec = command(task, argv);
  if (!spec) fail("UNKNOWN_TASK", task);
  const child = cp.spawn(spec[0], spec[1], { cwd: backend, env, stdio: "inherit", windowsHide: true });
  child.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
}
main();
