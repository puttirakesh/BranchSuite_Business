-- Persist branch metadata that was previously stored only on individual devices.
-- Existing branches receive stable generated codes. Review codes after deployment.
ALTER TABLE "Branch" ADD COLUMN "code" VARCHAR(20);
ALTER TABLE "Branch" ADD COLUMN "location" VARCHAR(240) NOT NULL DEFAULT '';
ALTER TABLE "Branch" ADD COLUMN "manager" VARCHAR(150) NOT NULL DEFAULT '';
UPDATE "Branch" SET "code" = 'BR' || UPPER(SUBSTRING(REPLACE("id"::text, '-', '') FROM 1 FOR 12)) WHERE "code" IS NULL;
ALTER TABLE "Branch" ALTER COLUMN "code" SET NOT NULL;
-- Fail safely if pre-existing case-insensitive duplicate branch names exist;
-- review and resolve duplicates before applying on databases with legacy data.
CREATE UNIQUE INDEX "Branch_company_name_ci_unique" ON "Branch" ("companyId", LOWER("name"));
CREATE UNIQUE INDEX "Branch_company_code_ci_unique" ON "Branch" ("companyId", LOWER("code"));
