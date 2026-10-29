import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export async function serializePayroll(tx: Prisma.TransactionClient, tenantId: string, companyId: string, branchId: string) {
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${`${tenantId}:${companyId}:${branchId}`}, 0))`;
}

export async function assertPayrollOpen(tx: Prisma.TransactionClient, scope: { tenantId: string; companyId: string; branchId: string }, start: Date, end = start) {
  await serializePayroll(tx, scope.tenantId, scope.companyId, scope.branchId);
  const closed = await tx.payrollRun.findFirst({ where: {
    ...scope, status: { in: ['CALCULATED', 'APPROVED', 'PAID'] },
    period: { startDate: { lte: end }, endDate: { gte: start } },
  }, select: { id: true, status: true } });
  if (closed) throw new ConflictException('Payroll has been calculated for these dates. Return calculated payroll for changes first; approved payroll requires a separate adjustment period.');
}
