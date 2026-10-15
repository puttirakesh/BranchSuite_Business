-- CreateEnum
CREATE TYPE "AttendanceCorrectionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "AttendanceCorrectionRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "attendanceId" TEXT NOT NULL,
    "requestedCheckInAt" TIMESTAMP(3) NOT NULL,
    "requestedCheckOutAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "AttendanceCorrectionStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceCorrectionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AttendanceCorrectionRequest_tenantId_companyId_branchId_sta_idx" ON "AttendanceCorrectionRequest"("tenantId", "companyId", "branchId", "status");

-- CreateIndex
CREATE INDEX "AttendanceCorrectionRequest_userId_createdAt_idx" ON "AttendanceCorrectionRequest"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AttendanceCorrectionRequest_attendanceId_status_idx" ON "AttendanceCorrectionRequest"("attendanceId", "status");

-- AddForeignKey
ALTER TABLE "AttendanceCorrectionRequest" ADD CONSTRAINT "AttendanceCorrectionRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceCorrectionRequest" ADD CONSTRAINT "AttendanceCorrectionRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceCorrectionRequest" ADD CONSTRAINT "AttendanceCorrectionRequest_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceCorrectionRequest" ADD CONSTRAINT "AttendanceCorrectionRequest_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "Attendance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceCorrectionRequest" ADD CONSTRAINT "AttendanceCorrectionRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceCorrectionRequest" ADD CONSTRAINT "AttendanceCorrectionRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
