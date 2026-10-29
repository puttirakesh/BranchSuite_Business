BEGIN;
ALTER TABLE "EmployeeProfile" ADD COLUMN "reportingManagerId" TEXT;
ALTER TABLE "EmployeeProfile" ADD CONSTRAINT "EmployeeProfile_reportingManagerId_fkey"
  FOREIGN KEY ("reportingManagerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "Notification" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "companyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL, "title" VARCHAR(180) NOT NULL, "message" VARCHAR(500) NOT NULL,
  "href" VARCHAR(240) NOT NULL, "readAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "Notification_tenantId_userId_readAt_createdAt_idx" ON "Notification"("tenantId", "userId", "readAt", "createdAt");

-- Legacy manager names are deliberately not guessed: HR selects a verified account.
ALTER TABLE "AttendanceCorrectionRequest" ALTER COLUMN "attendanceId" DROP NOT NULL;
-- Re-date recorded shifts in IST. Refuse ambiguous duplicates rather than discard history.
CREATE TEMP TABLE "_workflow_attendance_dates" ON COMMIT DROP AS
SELECT "id", "tenantId", "companyId", "branchId", "userId",
  CASE WHEN "checkInAt" IS NULL THEN "attendanceDate"
       ELSE ("checkInAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date END AS target_date,
  (SELECT MAX("attendanceDate") FROM "Attendance") + (ROW_NUMBER() OVER (ORDER BY "id"))::int AS staging_date
FROM "Attendance";
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "_workflow_attendance_dates" d
    JOIN "Attendance" a ON a.id = d.id
    JOIN "PayrollRun" r ON r."tenantId" = d."tenantId" AND r."companyId" = d."companyId" AND r."branchId" = d."branchId"
    JOIN "PayrollPeriod" p ON p.id = r."periodId"
    WHERE d.target_date <> a."attendanceDate" AND r.status IN ('CALCULATED','APPROVED','PAID')
      AND (a."attendanceDate" BETWEEN p."startDate" AND p."endDate" OR d.target_date BETWEEN p."startDate" AND p."endDate"))
  THEN RAISE EXCEPTION 'Review closed payroll periods affected by the IST attendance date correction before migration';
  END IF;
  IF EXISTS (SELECT 1 FROM "_workflow_attendance_dates"
    GROUP BY "tenantId", "companyId", "branchId", "userId", target_date HAVING COUNT(*) > 1)
  THEN RAISE EXCEPTION 'Reconcile duplicate shifts on the same IST business date before applying the workflow migration';
  END IF;
END $$;
-- Staging dates exceed every existing date, avoiding transient unique conflicts.
UPDATE "Attendance" a SET "attendanceDate" = d.staging_date FROM "_workflow_attendance_dates" d WHERE a.id = d.id;
UPDATE "Attendance" a SET "attendanceDate" = d.target_date FROM "_workflow_attendance_dates" d WHERE a.id = d.id;
ALTER TABLE "AttendanceCorrectionRequest" ADD COLUMN "requestedAttendanceDate" DATE;
UPDATE "AttendanceCorrectionRequest" r SET "requestedAttendanceDate" = a."attendanceDate"
  FROM "Attendance" a WHERE a."id" = r."attendanceId";
ALTER TABLE "AttendanceCorrectionRequest" ALTER COLUMN "requestedAttendanceDate" SET NOT NULL;
COMMIT;
