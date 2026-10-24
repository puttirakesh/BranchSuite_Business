ALTER TABLE "Company" ADD COLUMN "payslipSettings" JSONB,
  ADD COLUMN "payslipSettingsVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "payrollCalendar" JSONB;
ALTER TABLE "EmployeeProfile" ADD COLUMN "bankName" TEXT,
  ADD COLUMN "bankEnding" VARCHAR(4), ADD COLUMN "bankIfsc" VARCHAR(11),
  ADD COLUMN "pan" VARCHAR(10), ADD COLUMN "uan" VARCHAR(12);
ALTER TABLE "PayrollEntry" ADD COLUMN "identitySnapshot" JSONB,
  ADD COLUMN "paidDays" DECIMAL(6,2), ADD COLUMN "periodDays" INTEGER;
ALTER TABLE "SalaryAdvance" ADD COLUMN "disbursedAt" TIMESTAMP(3),
  ADD COLUMN "disbursedById" TEXT, ADD COLUMN "paymentReference" TEXT,
  ADD COLUMN "recoveryMonthly" DECIMAL(14,2), ADD COLUMN "recoveryStart" VARCHAR(7);
CREATE TABLE "PayrollAdvanceRecovery" (
  "id" TEXT NOT NULL, "advanceId" TEXT NOT NULL, "entryId" TEXT NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL CHECK ("amount" > 0),
  CONSTRAINT "PayrollAdvanceRecovery_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PayrollAdvanceRecovery_advanceId_fkey" FOREIGN KEY ("advanceId") REFERENCES "SalaryAdvance"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PayrollAdvanceRecovery_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "PayrollEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PayrollAdvanceRecovery_advanceId_entryId_key" ON "PayrollAdvanceRecovery"("advanceId", "entryId");
CREATE INDEX "PayrollAdvanceRecovery_entryId_idx" ON "PayrollAdvanceRecovery"("entryId");
