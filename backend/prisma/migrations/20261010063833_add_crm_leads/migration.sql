-- CreateEnum
CREATE TYPE "LeadStage" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST');

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "stage" "LeadStage" NOT NULL DEFAULT 'NEW',
    "createdById" TEXT NOT NULL,
    "assignedToId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Lead_tenantId_idx" ON "Lead"("tenantId");

-- CreateIndex
CREATE INDEX "Lead_companyId_idx" ON "Lead"("companyId");

-- CreateIndex
CREATE INDEX "Lead_branchId_idx" ON "Lead"("branchId");

-- CreateIndex
CREATE INDEX "Lead_createdById_idx" ON "Lead"("createdById");

-- CreateIndex
CREATE INDEX "Lead_assignedToId_idx" ON "Lead"("assignedToId");

-- CreateIndex
CREATE INDEX "Lead_tenantId_companyId_stage_idx" ON "Lead"("tenantId", "companyId", "stage");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
