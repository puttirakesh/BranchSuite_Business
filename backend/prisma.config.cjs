"use strict";

const guard = require("./scripts/safe-env/db-target-guard.cjs");

const command = process.argv.slice(2).find((a) => !a.startsWith("-"));
const DATABASE_COMMANDS = new Set(["migrate", "db", "studio"]);

if (DATABASE_COMMANDS.has(command)) {
  // Only `migrate deploy|status` may reach Neon apk-testing; production is always refused.
  guard.assertPrismaCommand(process.argv.slice(2), process.env);
}

module.exports = {
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "node -r ts-node/register/transpile-only prisma/seed.ts",
  },
};