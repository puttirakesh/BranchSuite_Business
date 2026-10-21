ALTER TABLE "Branch"
  ADD COLUMN "managerUserId" TEXT;

ALTER TABLE "Branch"
  ADD CONSTRAINT "Branch_managerUserId_fkey"
  FOREIGN KEY ("managerUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Branch_managerUserId_idx" ON "Branch"("managerUserId");

ALTER TABLE "UserBranchAccess"
  ADD COLUMN "grantSource" VARCHAR(20) NOT NULL DEFAULT 'MANUAL';

ALTER TABLE "UserCompanyAccess"
  ADD COLUMN "grantSource" VARCHAR(20) NOT NULL DEFAULT 'MANUAL';

ALTER TABLE "EmployeeDocument"
  ALTER COLUMN "content" DROP NOT NULL,
  ADD COLUMN "fileName" VARCHAR(255),
  ADD COLUMN "mimeType" VARCHAR(100),
  ADD COLUMN "fileSize" INTEGER,
  ADD COLUMN "fileData" BYTEA;

CREATE TABLE "UserWorkspacePreference" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "key" VARCHAR(40) NOT NULL,
  "value" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserWorkspacePreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserWorkspacePreference_userId_companyId_key_key"
  ON "UserWorkspacePreference"("userId", "companyId", "key");
CREATE INDEX "UserWorkspacePreference_companyId_key_idx"
  ON "UserWorkspacePreference"("companyId", "key");

ALTER TABLE "UserWorkspacePreference"
  ADD CONSTRAINT "UserWorkspacePreference_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "UserWorkspacePreference_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

WITH manager_matches AS (
  SELECT b."id" AS "branchId", u."id" AS "userId",
    COUNT(*) OVER (PARTITION BY b."id") AS "matchCount"
  FROM "Branch" b
  JOIN "Company" c ON c."id" = b."companyId"
  JOIN "User" u ON u."tenantId" = c."tenantId"
    AND LOWER(TRIM(u."name")) = LOWER(TRIM(b."manager"))
    AND u."status" = 'ACTIVE'
  JOIN "UserRole" ur ON ur."userId" = u."id"
  JOIN "Role" r ON r."id" = ur."roleId" AND r."name" = 'BRANCH_MANAGER'
  WHERE TRIM(b."manager") <> '' AND b."managerUserId" IS NULL
)
UPDATE "Branch" b
SET "managerUserId" = mm."userId"
FROM manager_matches mm
WHERE b."id" = mm."branchId" AND mm."matchCount" = 1;

INSERT INTO "UserCompanyAccess" ("userId", "companyId")
SELECT DISTINCT b."managerUserId", b."companyId"
FROM "Branch" b WHERE b."managerUserId" IS NOT NULL
ON CONFLICT ("userId", "companyId") DO NOTHING;

UPDATE "UserCompanyAccess" uca
SET "grantSource" = 'BRANCH_MANAGER'
WHERE uca."grantSource" = 'MANUAL'
  AND EXISTS (
    SELECT 1 FROM "Branch" b
    WHERE b."companyId" = uca."companyId"
      AND b."managerUserId" = uca."userId"
  )
  AND NOT EXISTS (
    SELECT 1 FROM "UserBranchAccess" uba
    JOIN "Branch" b ON b."id" = uba."branchId"
    WHERE uba."userId" = uca."userId"
      AND b."companyId" = uca."companyId"
      AND uba."grantSource" = 'MANUAL'
  );

INSERT INTO "UserBranchAccess" ("userId", "branchId", "grantSource")
SELECT b."managerUserId", b."id", 'BRANCH_MANAGER'
FROM "Branch" b WHERE b."managerUserId" IS NOT NULL
ON CONFLICT ("userId", "branchId") DO NOTHING;
