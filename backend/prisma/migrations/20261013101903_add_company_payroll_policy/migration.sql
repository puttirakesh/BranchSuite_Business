-- CreateEnum
CREATE TYPE "PayrollCalculationMode" AS ENUM ('FIXED', 'ATTENDANCE_BASED');

-- CreateEnum
CREATE TYPE "PayrollDayBasis" AS ENUM ('CALENDAR_DAYS');

-- CreateEnum
CREATE TYPE "MissingAttendanceAction" AS ENUM ('BLOCK_CALCULATION');

-- CreateTable
CREATE TABLE "CompanyPayrollPolicy" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "mode" "PayrollCalculationMode" NOT NULL DEFAULT 'FIXED',
    "dayBasis" "PayrollDayBasis" NOT NULL DEFAULT 'CALENDAR_DAYS',
    "missingAttendanceAction" "MissingAttendanceAction" NOT NULL DEFAULT 'BLOCK_CALCULATION',
    "halfDayDeduction" DECIMAL(3,2) NOT NULL DEFAULT 0.50,
    "deductUnpaidLeave" BOOLEAN NOT NULL DEFAULT true,
    "deductAbsentDays" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyPayrollPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanyPayrollPolicy_tenantId_companyId_effectiveFrom_idx" ON "CompanyPayrollPolicy"("tenantId", "companyId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyPayrollPolicy_companyId_version_key" ON "CompanyPayrollPolicy"("companyId", "version");

-- AddForeignKey
ALTER TABLE "CompanyPayrollPolicy" ADD CONSTRAINT "CompanyPayrollPolicy_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyPayrollPolicy" ADD CONSTRAINT "CompanyPayrollPolicy_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
