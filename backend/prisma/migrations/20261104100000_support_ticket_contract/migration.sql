-- Support ticket contract (forward-only, backward compatible).
-- Adds real relations, typed message authors, message visibility (CUSTOMER / INTERNAL) and closed value sets.
-- No data is deleted. Legacy "authorId" is kept and still written by the application.

-- Preflight: refuse (and roll back this migration) instead of silently dropping or orphaning data.
DO $$
DECLARE bad integer;
BEGIN
  SELECT count(*) INTO bad FROM "SupportTicket" t
   WHERE NOT EXISTS (SELECT 1 FROM "Tenant" x WHERE x."id" = t."tenantId")
      OR NOT EXISTS (SELECT 1 FROM "Company" c WHERE c."id" = t."companyId" AND c."tenantId" = t."tenantId")
      OR NOT EXISTS (SELECT 1 FROM "User" u WHERE u."id" = t."createdById" AND u."tenantId" = t."tenantId")
      OR (t."branchId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Branch" b WHERE b."id" = t."branchId" AND b."companyId" = t."companyId"));
  IF bad > 0 THEN
    RAISE EXCEPTION 'support_ticket_contract: % SupportTicket row(s) reference a missing or mismatched tenant/company/branch/creator; repair them before migrating', bad;
  END IF;
  SELECT count(*) INTO bad FROM "SupportTicket"
   WHERE "status" NOT IN ('OPEN','IN_PROGRESS','RESOLVED','CLOSED')
      OR "priority" NOT IN ('LOW','NORMAL','HIGH','URGENT');
  IF bad > 0 THEN
    RAISE EXCEPTION 'support_ticket_contract: % SupportTicket row(s) have a status/priority outside the supported set', bad;
  END IF;
END $$;

-- AlterTable
ALTER TABLE "SupportTicketMessage" ADD COLUMN     "authorRole" VARCHAR(30) NOT NULL DEFAULT 'REQUESTER',
ADD COLUMN     "businessAuthorId" TEXT,
ADD COLUMN     "platformAuthorId" TEXT,
ADD COLUMN     "visibility" VARCHAR(20) NOT NULL DEFAULT 'CUSTOMER';

-- Backfill typed authors from the legacy polymorphic authorId.
UPDATE "SupportTicketMessage" m SET "businessAuthorId" = m."authorId"
 WHERE EXISTS (SELECT 1 FROM "User" u WHERE u."id" = m."authorId");
UPDATE "SupportTicketMessage" m SET "platformAuthorId" = m."authorId", "authorRole" = p."role"::text
  FROM "PlatformUser" p
 WHERE p."id" = m."authorId" AND m."businessAuthorId" IS NULL;
UPDATE "SupportTicketMessage" m
   SET "authorRole" = CASE WHEN m."authorId" = t."createdById" THEN 'REQUESTER' ELSE 'COMPANY_ADMIN' END
  FROM "SupportTicket" t
 WHERE t."id" = m."ticketId" AND m."platformAuthorId" IS NULL;

-- CreateIndex
CREATE INDEX "SupportTicket_status_updatedAt_idx" ON "SupportTicket"("status", "updatedAt");
CREATE INDEX "SupportTicket_branchId_idx" ON "SupportTicket"("branchId");
CREATE INDEX "SupportTicketMessage_ticketId_visibility_createdAt_idx" ON "SupportTicketMessage"("ticketId", "visibility", "createdAt");

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "SupportTicketMessage" ADD CONSTRAINT "SupportTicketMessage_businessAuthorId_fkey" FOREIGN KEY ("businessAuthorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupportTicketMessage" ADD CONSTRAINT "SupportTicketMessage_platformAuthorId_fkey" FOREIGN KEY ("platformAuthorId") REFERENCES "PlatformUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Closed value sets.
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_status_check" CHECK ("status" IN ('OPEN','IN_PROGRESS','RESOLVED','CLOSED'));
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_priority_check" CHECK ("priority" IN ('LOW','NORMAL','HIGH','URGENT'));
ALTER TABLE "SupportTicketMessage" ADD CONSTRAINT "SupportTicketMessage_visibility_check" CHECK ("visibility" IN ('CUSTOMER','INTERNAL'));
ALTER TABLE "SupportTicketMessage" ADD CONSTRAINT "SupportTicketMessage_authorRole_check" CHECK ("authorRole" IN ('REQUESTER','COMPANY_ADMIN','PLATFORM_SUPPORT','PLATFORM_ADMIN'));
-- At most one typed author; role must match the author kind; internal notes can only be written by platform roles.
ALTER TABLE "SupportTicketMessage" ADD CONSTRAINT "SupportTicketMessage_single_author_check" CHECK ("businessAuthorId" IS NULL OR "platformAuthorId" IS NULL);
ALTER TABLE "SupportTicketMessage" ADD CONSTRAINT "SupportTicketMessage_author_role_kind_check" CHECK (
  ("platformAuthorId" IS NULL OR "authorRole" IN ('PLATFORM_SUPPORT','PLATFORM_ADMIN'))
  AND ("businessAuthorId" IS NULL OR "authorRole" IN ('REQUESTER','COMPANY_ADMIN')));
ALTER TABLE "SupportTicketMessage" ADD CONSTRAINT "SupportTicketMessage_internal_platform_check" CHECK ("visibility" = 'CUSTOMER' OR "authorRole" IN ('PLATFORM_SUPPORT','PLATFORM_ADMIN'));

-- Cross-table consistency a plain FK cannot express: company belongs to tenant, branch to company, creator to tenant.
CREATE OR REPLACE FUNCTION "support_ticket_scope_guard"() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "Company" WHERE "id" = NEW."companyId" AND "tenantId" = NEW."tenantId") THEN
    RAISE EXCEPTION 'SupportTicket company does not belong to the ticket tenant' USING ERRCODE = '23514';
  END IF;
  IF NEW."branchId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Branch" WHERE "id" = NEW."branchId" AND "companyId" = NEW."companyId") THEN
    RAISE EXCEPTION 'SupportTicket branch does not belong to the ticket company' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "User" WHERE "id" = NEW."createdById" AND "tenantId" = NEW."tenantId") THEN
    RAISE EXCEPTION 'SupportTicket creator does not belong to the ticket tenant' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "SupportTicket_scope_guard"
  BEFORE INSERT OR UPDATE OF "tenantId", "companyId", "branchId", "createdById" ON "SupportTicket"
  FOR EACH ROW EXECUTE FUNCTION "support_ticket_scope_guard"();
