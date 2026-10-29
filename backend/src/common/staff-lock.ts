import { Prisma } from '@prisma/client';
export async function lockStaff(tx: Prisma.TransactionClient, ...ids: string[]) {
  for (const id of [...new Set(ids)].sort()) {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${id} FOR UPDATE`;
  }
}
