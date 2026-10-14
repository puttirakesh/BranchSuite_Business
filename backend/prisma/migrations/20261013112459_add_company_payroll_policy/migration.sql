-- AlterTable
ALTER TABLE "PayrollRun" ADD COLUMN     "policyIdSnapshot" TEXT,
ADD COLUMN     "policyModeSnapshot" "PayrollCalculationMode",
ADD COLUMN     "policySettingsSnapshot" JSONB,
ADD COLUMN     "policySnapshotAt" TIMESTAMP(3),
ADD COLUMN     "policyVersionSnapshot" INTEGER;
