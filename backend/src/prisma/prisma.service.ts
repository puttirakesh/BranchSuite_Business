import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

type LocalGuard = {
  assertSafeDatabaseTarget(env: NodeJS.ProcessEnv): {
    enforced: boolean;
    attestation?: unknown;
  };
  assertLiveIdentity(row: unknown, attestation: unknown): boolean;
  LIVE_IDENTITY_SQL: string;
};

// Development-only database target guard (see scripts/safe-env). A process
// running with NODE_ENV=production never loads it, so hosted deploys are
// unaffected. Any other process must target an attested loopback database.
function loadLocalGuard(): LocalGuard | null {
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.BRANCHSUITE_FORCE_LOCAL_GUARD !== '1'
  )
    return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('../../scripts/safe-env/db-target-guard.cjs') as LocalGuard;
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly localGuard: LocalGuard | null;
  private readonly localAttestation: unknown;

  constructor() {
    super();
    this.localGuard = loadLocalGuard();
    const check = this.localGuard?.assertSafeDatabaseTarget(process.env);
    this.localAttestation = check?.enforced ? check.attestation : null;
  }

  async onModuleInit() {
    await this.$connect();
    if (this.localGuard && this.localAttestation) {
      try {
        const rows = await this.$queryRawUnsafe<unknown[]>(
          this.localGuard.LIVE_IDENTITY_SQL,
        );
        this.localGuard.assertLiveIdentity(rows[0], this.localAttestation);
      } catch (error) {
        await this.$disconnect();
        throw error;
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
