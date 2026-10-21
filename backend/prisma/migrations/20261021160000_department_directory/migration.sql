CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "name" VARCHAR(100) NOT NULL,
    "normalizedName" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Department_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Department_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Department_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Department_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Department_companyId_branchId_normalizedName_key" ON "Department"("companyId", "branchId", "normalizedName");
-- PostgreSQL treats NULL branch IDs as distinct; company-wide names also need uniqueness.
CREATE UNIQUE INDEX "Department_company_wide_name_key" ON "Department"("companyId", "normalizedName") WHERE "branchId" IS NULL;
CREATE INDEX "Department_tenantId_companyId_idx" ON "Department"("tenantId", "companyId");

-- Preserve department names already assigned to employees, in their original branches.
INSERT INTO "Department" ("id", "tenantId", "companyId", "branchId", "name", "normalizedName", "updatedAt")
SELECT gen_random_uuid()::text, "tenantId", "companyId", "branchId", "name", lower("name"), CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT ON ("tenantId", "companyId", "branchId", lower(btrim(regexp_replace("department", '\s+', ' ', 'g'))))
    "tenantId", "companyId", "branchId", btrim(regexp_replace("department", '\s+', ' ', 'g')) AS "name"
  FROM "EmployeeProfile"
  WHERE "department" IS NOT NULL AND btrim("department") <> ''
  ORDER BY "tenantId", "companyId", "branchId", lower(btrim(regexp_replace("department", '\s+', ' ', 'g'))), "createdAt", "id"
) existing;
