CREATE TABLE "AuditEvent" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT,
  "branchId" TEXT,
  "actorId" TEXT NOT NULL,
  "action" VARCHAR(100) NOT NULL,
  "module" VARCHAR(60) NOT NULL,
  "targetId" VARCHAR(100) NOT NULL,
  "detail" VARCHAR(500) NOT NULL DEFAULT '',
  "changes" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AuditEvent_tenantId_createdAt_idx" ON "AuditEvent"("tenantId", "createdAt");
CREATE INDEX "AuditEvent_tenantId_companyId_createdAt_idx" ON "AuditEvent"("tenantId", "companyId", "createdAt");
CREATE INDEX "AuditEvent_tenantId_branchId_createdAt_idx" ON "AuditEvent"("tenantId", "branchId", "createdAt");
CREATE INDEX "AuditEvent_tenantId_module_createdAt_idx" ON "AuditEvent"("tenantId", "module", "createdAt");
