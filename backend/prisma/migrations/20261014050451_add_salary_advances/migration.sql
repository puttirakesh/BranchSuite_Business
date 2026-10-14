-- CreateEnum
CREATE TYPE "SalaryAdvanceStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "SalaryAdvance" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "reason" VARCHAR(1000) NOT NULL,
    "status" "SalaryAdvanceStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" VARCHAR(1000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalaryAdvance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalaryAdvance_tenantId_companyId_branchId_status_idx" ON "SalaryAdvance"("tenantId", "companyId", "branchId", "status");

-- CreateIndex
CREATE INDEX "SalaryAdvance_userId_createdAt_idx" ON "SalaryAdvance"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SalaryAdvance_reviewedById_idx" ON "SalaryAdvance"("reviewedById");

-- AddForeignKey
ALTER TABLE "SalaryAdvance" ADD CONSTRAINT "SalaryAdvance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryAdvance" ADD CONSTRAINT "SalaryAdvance_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryAdvance" ADD CONSTRAINT "SalaryAdvance_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryAdvance" ADD CONSTRAINT "SalaryAdvance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryAdvance" ADD CONSTRAINT "SalaryAdvance_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
