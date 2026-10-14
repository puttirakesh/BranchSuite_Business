-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN');

-- CreateEnum
CREATE TYPE "EmploymentStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'EXITED');

-- CreateTable
CREATE TABLE "EmployeeProfile" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "employeeCode" TEXT NOT NULL,
    "department" TEXT,
    "designation" TEXT,
    "employmentType" "EmploymentType" NOT NULL DEFAULT 'FULL_TIME',
    "status" "EmploymentStatus" NOT NULL DEFAULT 'ACTIVE',
    "joiningDate" DATE NOT NULL,
    "exitDate" DATE,
    "workEmail" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmployeeProfile_tenantId_companyId_branchId_status_idx" ON "EmployeeProfile"("tenantId", "companyId", "branchId", "status");

-- CreateIndex
CREATE INDEX "EmployeeProfile_userId_idx" ON "EmployeeProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeProfile_companyId_userId_key" ON "EmployeeProfile"("companyId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeProfile_companyId_employeeCode_key" ON "EmployeeProfile"("companyId", "employeeCode");

-- AddForeignKey
ALTER TABLE "EmployeeProfile" ADD CONSTRAINT "EmployeeProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeProfile" ADD CONSTRAINT "EmployeeProfile_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeProfile" ADD CONSTRAINT "EmployeeProfile_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeProfile" ADD CONSTRAINT "EmployeeProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
