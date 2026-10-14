-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('CALL', 'MEETING', 'EMAIL', 'TASK', 'FOLLOW_UP');

-- CreateEnum
CREATE TYPE "ActivityStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "CrmActivity" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "leadId" TEXT,
    "customerId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "ActivityType" NOT NULL,
    "status" "ActivityStatus" NOT NULL DEFAULT 'PENDING',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "assignedToId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CrmActivity_tenantId_idx" ON "CrmActivity"("tenantId");

-- CreateIndex
CREATE INDEX "CrmActivity_companyId_idx" ON "CrmActivity"("companyId");

-- CreateIndex
CREATE INDEX "CrmActivity_branchId_idx" ON "CrmActivity"("branchId");

-- CreateIndex
CREATE INDEX "CrmActivity_leadId_idx" ON "CrmActivity"("leadId");

-- CreateIndex
CREATE INDEX "CrmActivity_customerId_idx" ON "CrmActivity"("customerId");

-- CreateIndex
CREATE INDEX "CrmActivity_assignedToId_idx" ON "CrmActivity"("assignedToId");

-- CreateIndex
CREATE INDEX "CrmActivity_tenantId_status_scheduledAt_idx" ON "CrmActivity"("tenantId", "status", "scheduledAt");

-- AddForeignKey
ALTER TABLE "CrmActivity" ADD CONSTRAINT "CrmActivity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmActivity" ADD CONSTRAINT "CrmActivity_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmActivity" ADD CONSTRAINT "CrmActivity_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmActivity" ADD CONSTRAINT "CrmActivity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmActivity" ADD CONSTRAINT "CrmActivity_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmActivity" ADD CONSTRAINT "CrmActivity_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmActivity" ADD CONSTRAINT "CrmActivity_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
