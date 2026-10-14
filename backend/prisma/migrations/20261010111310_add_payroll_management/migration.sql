-- CreateEnum
CREATE TYPE "SalaryComponentKind" AS ENUM ('EARNING', 'DEDUCTION');

-- CreateEnum
CREATE TYPE "PayrollStatus" AS ENUM ('DRAFT', 'CALCULATED', 'APPROVED', 'PAID');

-- CreateEnum
CREATE TYPE "PayrollPaymentMethod" AS ENUM ('BANK_TRANSFER', 'CASH', 'UPI', 'OTHER');

-- CreateTable
CREATE TABLE "SalaryStructure" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "basicAmount" DECIMAL(14,2) NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalaryStructure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryComponent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "structureId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "SalaryComponentKind" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalaryComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeSalary" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "structureId" TEXT NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "basicOverride" DECIMAL(14,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeSalary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollPeriod" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollRun" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "status" "PayrollStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "calculatedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "grossTotal" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "deductionsTotal" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "netTotal" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollEntry" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "employeeSalaryId" TEXT,
    "currency" TEXT NOT NULL,
    "basicAmount" DECIMAL(14,2) NOT NULL,
    "grossAmount" DECIMAL(14,2) NOT NULL,
    "deductionsAmount" DECIMAL(14,2) NOT NULL,
    "netAmount" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollEntryComponent" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "SalaryComponentKind" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "PayrollEntryComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollPayment" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "method" "PayrollPaymentMethod" NOT NULL,
    "reference" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalaryStructure_tenantId_companyId_idx" ON "SalaryStructure"("tenantId", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryStructure_companyId_name_key" ON "SalaryStructure"("companyId", "name");

-- CreateIndex
CREATE INDEX "SalaryComponent_tenantId_companyId_idx" ON "SalaryComponent"("tenantId", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryComponent_structureId_code_key" ON "SalaryComponent"("structureId", "code");

-- CreateIndex
CREATE INDEX "EmployeeSalary_tenantId_companyId_branchId_idx" ON "EmployeeSalary"("tenantId", "companyId", "branchId");

-- CreateIndex
CREATE INDEX "EmployeeSalary_userId_effectiveFrom_idx" ON "EmployeeSalary"("userId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeSalary_companyId_branchId_userId_effectiveFrom_key" ON "EmployeeSalary"("companyId", "branchId", "userId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "PayrollPeriod_tenantId_companyId_branchId_idx" ON "PayrollPeriod"("tenantId", "companyId", "branchId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollPeriod_companyId_branchId_year_month_key" ON "PayrollPeriod"("companyId", "branchId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRun_periodId_key" ON "PayrollRun"("periodId");

-- CreateIndex
CREATE INDEX "PayrollRun_tenantId_companyId_branchId_status_idx" ON "PayrollRun"("tenantId", "companyId", "branchId", "status");

-- CreateIndex
CREATE INDEX "PayrollEntry_userId_idx" ON "PayrollEntry"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollEntry_runId_userId_key" ON "PayrollEntry"("runId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollEntryComponent_entryId_code_key" ON "PayrollEntryComponent"("entryId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollPayment_entryId_key" ON "PayrollPayment"("entryId");

-- CreateIndex
CREATE INDEX "PayrollPayment_recordedById_idx" ON "PayrollPayment"("recordedById");

-- AddForeignKey
ALTER TABLE "SalaryStructure" ADD CONSTRAINT "SalaryStructure_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryStructure" ADD CONSTRAINT "SalaryStructure_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryComponent" ADD CONSTRAINT "SalaryComponent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryComponent" ADD CONSTRAINT "SalaryComponent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryComponent" ADD CONSTRAINT "SalaryComponent_structureId_fkey" FOREIGN KEY ("structureId") REFERENCES "SalaryStructure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSalary" ADD CONSTRAINT "EmployeeSalary_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSalary" ADD CONSTRAINT "EmployeeSalary_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSalary" ADD CONSTRAINT "EmployeeSalary_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSalary" ADD CONSTRAINT "EmployeeSalary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSalary" ADD CONSTRAINT "EmployeeSalary_structureId_fkey" FOREIGN KEY ("structureId") REFERENCES "SalaryStructure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollPeriod" ADD CONSTRAINT "PayrollPeriod_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollPeriod" ADD CONSTRAINT "PayrollPeriod_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollPeriod" ADD CONSTRAINT "PayrollPeriod_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "PayrollPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollEntry" ADD CONSTRAINT "PayrollEntry_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollEntry" ADD CONSTRAINT "PayrollEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollEntry" ADD CONSTRAINT "PayrollEntry_employeeSalaryId_fkey" FOREIGN KEY ("employeeSalaryId") REFERENCES "EmployeeSalary"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollEntryComponent" ADD CONSTRAINT "PayrollEntryComponent_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "PayrollEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollPayment" ADD CONSTRAINT "PayrollPayment_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "PayrollEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollPayment" ADD CONSTRAINT "PayrollPayment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
