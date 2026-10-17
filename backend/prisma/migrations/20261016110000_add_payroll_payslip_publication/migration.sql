-- Introduce explicit publication independently of payroll approval and settlement.
ALTER TABLE "PayrollRun" ADD COLUMN "publishedAt" TIMESTAMP(3), ADD COLUMN "publishedById" TEXT;
-- Maintain employee access to payslips issued by previous versions.
-- Review legacy approvals before applying to a real payroll database.
UPDATE "PayrollRun" SET "publishedAt" = "approvedAt"
WHERE "approvedAt" IS NOT NULL AND "status" IN ('APPROVED', 'PAID');
