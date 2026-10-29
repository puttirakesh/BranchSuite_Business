ALTER TABLE "UserRole"
  ADD COLUMN "id" TEXT,
  ADD COLUMN "companyId" TEXT;

UPDATE "UserRole"
SET "id" = "userId" || ':' || "roleId";

ALTER TABLE "UserRole" DROP CONSTRAINT "UserRole_pkey";

-- Preserve the current effective access during migration by copying each
-- non-administrator role into every company the user already belongs to.
INSERT INTO "UserRole" ("id", "userId", "roleId", "companyId", "createdAt")
SELECT
  ur."userId" || ':' || ur."roleId" || ':' || access."companyId",
  ur."userId",
  ur."roleId",
  access."companyId",
  ur."createdAt"
FROM "UserRole" ur
JOIN "Role" role ON role."id" = ur."roleId"
JOIN "UserCompanyAccess" access ON access."userId" = ur."userId"
WHERE role."name" NOT IN ('BUSINESS_OWNER', 'BUSINESS_ADMIN');

DELETE FROM "UserRole" ur
USING "Role" role
WHERE role."id" = ur."roleId"
  AND role."name" NOT IN ('BUSINESS_OWNER', 'BUSINESS_ADMIN')
  AND EXISTS (
    SELECT 1 FROM "UserCompanyAccess" access WHERE access."userId" = ur."userId"
  );

ALTER TABLE "UserRole"
  ALTER COLUMN "id" SET NOT NULL,
  ADD CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id"),
  ADD CONSTRAINT "UserRole_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "UserRole_userId_companyId_idx" ON "UserRole"("userId", "companyId");
CREATE UNIQUE INDEX "UserRole_global_user_role_key"
  ON "UserRole"("userId", "roleId") WHERE "companyId" IS NULL;
CREATE UNIQUE INDEX "UserRole_company_user_role_key"
  ON "UserRole"("userId", "companyId", "roleId") WHERE "companyId" IS NOT NULL;
