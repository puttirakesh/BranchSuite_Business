# APK-testing port 4000 preparation

This directory is **preparation only**. It does not start NestJS, connect to a
database, resolve secrets, authorize writes or replace the local guard.

`development-plan.json` records the exact APK identity, development port 4000,
process-scoped Expo settings and symbolic secret references. The resolver is
not provisioned; `secret://` entries are names, not working credentials.

Safe offline commands from the repository root:

```powershell
node backend/scripts/apk-testing/prepare.cjs
node --test backend/scripts/apk-testing/policy.test.cjs
```

The first command (also `npm run dev:apk`) is the single APK preflight: it
refuses inherited database/dotenv/`NODE_ENV` overrides, rechecks the LAN address,
probes that port 4000 is free (bind/release only), evaluates
`development-plan.json#runtimeGates`, prints every blocker and exits 2. Any
argument, including `--start`, is refused. There is no execution flag or
environment variable that enables this module.

`policy.cjs` also provides the pure building blocks for the future approved
runtime: `assertCleanInheritedEnvironment`, `validateRuntimeSecrets` (separate
application vs migration roles, distinct JWT secrets), `buildChildEnvironment`
(development, port 4000, loopback, no `DIRECT_URL`, `DOTENV_CONFIG_PATH` set to
the empty `no-dotenv.env`, email disabled) and `evaluateRuntimeGates`. They are
covered by `npm run test:apk-policy`. `runtimeGates` is recorded status only;
editing it cannot start the backend.

## Separate runtime policy design — not yet integrated

The existing `safe-env/db-target-guard.cjs`, Prisma configuration and PrismaService
remain unchanged. They continue refusing Neon in development. A later reviewed
APK runtime integration must satisfy all of the following:

1. Use an explicit APK launcher/Prisma access policy. Retain the existing local
   policy as-is and keep `NODE_ENV=development`; do not use production mode to
   disable enforcement. Ordinary startup must never gain implicit APK access.
2. Resolve application/direct database and JWT secrets through the approved
   private resolver into a minimal child-process environment. Never load
   `backend/.env`, safe-local configuration or inherited database variables as
   fallback. Disable dotenv fallback, outbound email and preview data.
3. Validate the complete host/database/schema/TLS policy before connecting.
   Require exact project/branch/endpoint metadata and fresh SQL identity from
   that actual connection in a read-only transaction. Tool-managed SQL evidence
   alone does not verify the eventual private Prisma connection.
4. Verify all 44 reviewed ledger entries, no unfinished rows, and the full
   Support/EmployeeDocument post-schema definitions before accepting startup.
   Historical source checksums must be assessed against reviewed artifact
   provenance, never fixed by editing the database ledger.
5. Record named APK-owner access approval and writer coordination. Use an
   approved application role with no schema/migration authority; application
   access is separate from migration authorization. Existing records must not
   be seeded, reset, cleaned up or changed as startup work.
6. Integrate those checks into PrismaService before admitting remote traffic.
   Keep the old guard's production refusal and local attestation behavior.
   Neither `DATABASE_URL`, `NODE_ENV` nor an ordinary flag may silently select
   the APK path. Review the actual integration and its refusal tests separately.
7. Keep loopback binding by default. To serve phones via the verified LAN IP,
   record the populated-development-data exposure approval, bind only the
   intended interface and configure restricted firewall/CORS access. Never
   expose this backend publicly.
8. Recheck port 4000, Metro process ownership and current LAN IP immediately
   before approved startup. Do not terminate another developer's processes.

For Prisma 6, the proposed URL policy requires `sslmode=require` and
`sslaccept=strict` (an appropriate `sslcert` may be needed). The policy's URL
validator is pure/static; it is not a TLS handshake test. See the readiness
report for the tool-managed SQL session's `ssl=false` observation and limitation.

Read `docs/BRANCHSUITE_NEON_APK_PORT4000_READINESS.md` for actual migration/schema
results and blockers. No migration command is provided here.
