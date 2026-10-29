-- APK parity: payment status, deal incentives, bank verification, branch shifts.
-- Existing bank details start unverified so a second person must confirm them.
-- CreateEnum
CREATE TYPE "PayrollPaymentStatus" AS ENUM ('PROCESSING', 'CONFIRMED', 'FAILED');

-- CreateEnum
CREATE TYPE "DealIncentiveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Branch" ADD COLUMN     "graceMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "shiftEnd" VARCHAR(5),
ADD COLUMN     "shiftStart" VARCHAR(5);

-- AlterTable
ALTER TABLE "EmployeeProfile" ADD COLUMN     "bankChangedAt" TIMESTAMP(3),
ADD COLUMN     "bankChangedById" TEXT,
ADD COLUMN     "bankVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "bankVerifiedById" TEXT;

-- AlterTable
ALTER TABLE "PayrollPayment" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "confirmedAt" TIMESTAMP(3),
ADD COLUMN     "failureReason" VARCHAR(300),
ADD COLUMN     "status" "PayrollPaymentStatus" NOT NULL DEFAULT 'CONFIRMED',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "DealIncentive" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "description" VARCHAR(300) NOT NULL,
    "status" "DealIncentiveStatus" NOT NULL DEFAULT 'PENDING',
    "createdById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" VARCHAR(300),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealIncentive_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DealIncentive_dealId_key" ON "DealIncentive"("dealId");

-- CreateIndex
CREATE INDEX "DealIncentive_tenantId_companyId_branchId_year_month_status_idx" ON "DealIncentive"("tenantId", "companyId", "branchId", "year", "month", "status");

-- CreateIndex
CREATE INDEX "DealIncentive_userId_idx" ON "DealIncentive"("userId");


-- Payments recorded before status tracking were confirmed when recorded.
UPDATE "PayrollPayment" SET "confirmedAt" = "paidAt" WHERE "confirmedAt" IS NULL;
