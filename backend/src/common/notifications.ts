import { Prisma } from '@prisma/client';

export async function notify(tx: Prisma.TransactionClient, tenantId: string, companyId: string, userId: string, title: string, message: string, href: string) {
  await tx.notification.create({ data: { tenantId, companyId, userId, title, message, href } });
}
