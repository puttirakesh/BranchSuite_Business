CREATE TABLE "EmployeeBankAccountIdentity" (
    "employeeProfileId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "fingerprint" CHAR(64) NOT NULL,
    CONSTRAINT "EmployeeBankAccountIdentity_pkey" PRIMARY KEY ("employeeProfileId"),
    CONSTRAINT "EmployeeBankAccountIdentity_employeeProfileId_fkey"
      FOREIGN KEY ("employeeProfileId") REFERENCES "EmployeeProfile"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "EmployeeBankAccountIdentity_companyId_fingerprint_key"
ON "EmployeeBankAccountIdentity"("companyId", "fingerprint");

CREATE INDEX "EmployeeProfile_companyId_pan_idx"
ON "EmployeeProfile"("companyId", "pan");

CREATE INDEX "EmployeeProfile_companyId_uan_idx"
ON "EmployeeProfile"("companyId", "uan");

CREATE INDEX "EmployeeProfile_companyId_workEmail_idx"
ON "EmployeeProfile"("companyId", "workEmail");
