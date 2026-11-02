-- Employee-uploaded documents are shared with the employee's reporting manager.
ALTER TABLE "EmployeeDocument" ADD COLUMN "reportingToId" TEXT;

CREATE INDEX "EmployeeDocument_tenantId_reportingToId_createdAt_idx" ON "EmployeeDocument"("tenantId", "reportingToId", "createdAt");
