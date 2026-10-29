import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
export async function assertNoApprovedLeave(tx: Prisma.TransactionClient, tenantId: string, companyId: string, userId: string, date: Date) {
  if (await tx.leaveRequest.count({ where: { tenantId, companyId, userId, status: 'APPROVED', startDate: { lte: date }, endDate: { gte: date } } })) {
    throw new ConflictException('Cancel or resolve the approved leave before recording attendance for this date');
  }
}
