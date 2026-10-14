-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'HALF_DAY', 'ON_LEAVE');

-- CreateEnum
CREATE TYPE "AttendanceSource" AS ENUM ('SELF', 'MANUAL', 'SYSTEM');

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "attendanceDate" DATE NOT NULL,
    "checkInAt" TIMESTAMP(3),
    "checkOutAt" TIMESTAMP(3),
    "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
    "source" "AttendanceSource" NOT NULL DEFAULT 'SELF',
    "totalMinutes" INTEGER NOT NULL DEFAULT 0,
    "lateMinutes" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "markedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Attendance_tenantId_attendanceDate_idx" ON "Attendance"("tenantId", "attendanceDate");

-- CreateIndex
CREATE INDEX "Attendance_companyId_attendanceDate_idx" ON "Attendance"("companyId", "attendanceDate");

-- CreateIndex
CREATE INDEX "Attendance_branchId_attendanceDate_idx" ON "Attendance"("branchId", "attendanceDate");

-- CreateIndex
CREATE INDEX "Attendance_userId_attendanceDate_idx" ON "Attendance"("userId", "attendanceDate");

-- CreateIndex
CREATE INDEX "Attendance_status_idx" ON "Attendance"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_tenantId_companyId_branchId_userId_attendanceDat_key" ON "Attendance"("tenantId", "companyId", "branchId", "userId", "attendanceDate");

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_markedById_fkey" FOREIGN KEY ("markedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
