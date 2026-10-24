ALTER TABLE "LeaveRequest" ADD COLUMN "reportingToId" TEXT;
CREATE INDEX "LeaveRequest_reportingToId_idx" ON "LeaveRequest"("reportingToId");
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_reportingToId_fkey" FOREIGN KEY ("reportingToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
