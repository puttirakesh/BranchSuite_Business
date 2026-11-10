"use strict";
// Prisma CLI configuration for the BranchSuite backend.
//
// Two effects, both deliberate:
//  1. When a Prisma config file exists, the Prisma CLI does NOT auto-load
//     backend/.env. A bare `npx prisma migrate ...` therefore fails (missing
//     DATABASE_URL) instead of silently using whatever .env contains.
//  2. Every database-touching command is checked against the local database
//     guard before it runs. Production or remote targets are refused.
//
// Use the approved launcher: `npm run safe -- prisma <args>` (see
// docs/BRANCHSUITE_SAFE_LOCAL_ENVIRONMENT_REPORT.md).
// A hosted production deploy sets NODE_ENV=production and is not enforced.
const guard = require("./scripts/safe-env/db-target-guard.cjs");

const command = process.argv.slice(2).find((a) => !a.startsWith("-"));
const DATABASE_COMMANDS = new Set(["migrate", "db", "studio"]);

if (DATABASE_COMMANDS.has(command)) guard.assertSafeDatabaseTarget(process.env);

module.exports = {
  schema: "prisma/schema.prisma",
  // Keeps `prisma db seed` working now that this file overrides package.json#prisma.
  migrations: { seed: "node -r ts-node/register/transpile-only prisma/seed.ts" },
};
