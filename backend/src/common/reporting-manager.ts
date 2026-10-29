import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export async function validateReportingManager(tx: Prisma.TransactionClient, tenantId: string, companyId: string, branchId: string, managerId: string, employeeId?: string) {
  if (managerId === employeeId) throw new BadRequestException('An employee cannot report to themselves');
  const person = await tx.user.findFirst({ where: {
    id: managerId, tenantId, status: 'ACTIVE',
    roles: { some: { OR: [{ companyId: null, role: { name: { in: ['BUSINESS_OWNER', 'BUSINESS_ADMIN'] } } }, { companyId }], role: { name: { in: ['BUSINESS_OWNER', 'BUSINESS_ADMIN', 'COMPANY_MANAGER', 'BRANCH_MANAGER', 'HR_MANAGER'] } } } },
    OR: [{ roles: { some: { companyId: null, role: { name: 'BUSINESS_OWNER' } } } },
      { companyAccess: { some: { companyId } }, branchAccess: { some: { branchId } } }],
  }, select: { id: true } });
  if (!person) throw new BadRequestException('Choose an active review-capable manager assigned to this company and branch');
  const seen = new Set<string>(employeeId ? [employeeId] : []);
  let current: string | null = managerId;
  while (current) {
    if (seen.has(current) || seen.size > 100) throw new BadRequestException('Reporting relationships cannot form a cycle');
    seen.add(current);
    const profile: { reportingManagerId: string | null } | null = await tx.employeeProfile.findUnique({
      where: { companyId_userId: { companyId, userId: current } }, select: { reportingManagerId: true },
    });
    current = profile?.reportingManagerId ?? null;
  }
}
