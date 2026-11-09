-- Phase 2: additive only. Production rollout is NOT authorized.
BEGIN;
ALTER TABLE "SupportTicket"
 ADD COLUMN "assignedToId" TEXT,
 ADD COLUMN "assignedAt" TIMESTAMP(3),
 ADD COLUMN "supportRevision" INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN "slaPolicyVersion" VARCHAR(80),
 ADD COLUMN "responseTargetMinutes" INTEGER,
 ADD COLUMN "resolutionTargetMinutes" INTEGER,
 ADD COLUMN "responseDueAt" TIMESTAMP(3),
 ADD COLUMN "resolutionDueAt" TIMESTAMP(3),
 ADD COLUMN "firstResponseAt" TIMESTAMP(3),
 ADD COLUMN "resolvedAt" TIMESTAMP(3),
 ADD COLUMN "escalationStatus" VARCHAR(20) NOT NULL DEFAULT 'NONE',
 ADD COLUMN "escalationReason" VARCHAR(2000),
 ADD COLUMN "escalatedAt" TIMESTAMP(3),
 ADD COLUMN "escalatedById" TEXT,
 ADD COLUMN "customerActivityVersion" INTEGER NOT NULL DEFAULT 1,
 ADD COLUMN "customerActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Populate only the newly added activity timestamp. Do not invent legacy SLA outcomes.
UPDATE "SupportTicket" t SET "customerActivityAt" = COALESCE(
 (SELECT MAX(m."createdAt") FROM "SupportTicketMessage" m WHERE m."ticketId"=t.id AND m.visibility='CUSTOMER' AND m."authorRole" IN ('REQUESTER','COMPANY_ADMIN')), t."createdAt");

ALTER TABLE "SupportTicket"
 ADD CONSTRAINT "SupportTicket_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "PlatformUser"(id) ON DELETE SET NULL ON UPDATE CASCADE,
 ADD CONSTRAINT "SupportTicket_escalatedById_fkey" FOREIGN KEY ("escalatedById") REFERENCES "PlatformUser"(id) ON DELETE SET NULL ON UPDATE CASCADE,
 ADD CONSTRAINT "SupportTicket_supportRevision_check" CHECK ("supportRevision">=0 AND "customerActivityVersion">=1),
 ADD CONSTRAINT "SupportTicket_sla_targets_check" CHECK ("responseTargetMinutes">0 AND "resolutionTargetMinutes">="responseTargetMinutes"),
 ADD CONSTRAINT "SupportTicket_escalationStatus_check" CHECK ("escalationStatus" IN ('NONE','REQUESTED','ACKNOWLEDGED','RESOLVED'));

CREATE TABLE "SupportTicketReadState" (
 "ticketId" TEXT NOT NULL,
 "platformUserId" TEXT NOT NULL,
 "lastReadCustomerVersion" INTEGER NOT NULL DEFAULT 0 CHECK ("lastReadCustomerVersion">=0),
 "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY ("ticketId","platformUserId"),
 FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"(id) ON DELETE CASCADE ON UPDATE CASCADE,
 FOREIGN KEY ("platformUserId") REFERENCES "PlatformUser"(id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "SupportTicketReadState_platformUserId_idx" ON "SupportTicketReadState"("platformUserId");
CREATE INDEX "SupportTicket_assignedToId_updatedAt_idx" ON "SupportTicket"("assignedToId","updatedAt");
CREATE INDEX "SupportTicket_escalationStatus_updatedAt_idx" ON "SupportTicket"("escalationStatus","updatedAt");
CREATE INDEX "SupportTicket_responseDueAt_idx" ON "SupportTicket"("responseDueAt");
CREATE INDEX "SupportTicket_resolutionDueAt_idx" ON "SupportTicket"("resolutionDueAt");

CREATE FUNCTION "support_assignee_guard"() RETURNS trigger AS $$
BEGIN
 IF NEW."assignedToId" IS NOT NULL THEN
  PERFORM id FROM "PlatformUser" WHERE id=NEW."assignedToId" AND status='ACTIVE' AND role='PLATFORM_SUPPORT' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Assignee must be an active Support agent' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "SupportTicket_assignee_guard" BEFORE INSERT OR UPDATE OF "assignedToId" ON "SupportTicket" FOR EACH ROW EXECUTE FUNCTION "support_assignee_guard"();
COMMIT;
