ALTER TYPE "LeadStage" ADD VALUE IF NOT EXISTS 'NEGOTIATION';
ALTER TABLE "Lead"
  ADD COLUMN "contactPerson" TEXT,
  ADD COLUMN "source" TEXT,
  ADD COLUMN "estimatedValue" DECIMAL(18,2),
  ADD COLUMN "assignedEmployeeIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
UPDATE "Lead" SET "assignedEmployeeIds" = ARRAY["assignedToId"] WHERE "assignedToId" IS NOT NULL;
