CREATE TABLE "EmployeeDocument" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "title" VARCHAR(180) NOT NULL,
  "kind" VARCHAR(40) NOT NULL,
  "content" TEXT NOT NULL,
  "status" VARCHAR(30) NOT NULL DEFAULT 'VERIFIED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmployeeDocument_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EmployeeDocument_tenantId_companyId_employeeId_createdAt_idx" ON "EmployeeDocument"("tenantId","companyId","employeeId","createdAt");

CREATE TABLE "SupportTicket" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "branchId" TEXT,
  "createdById" TEXT NOT NULL,
  "subject" VARCHAR(180) NOT NULL,
  "category" VARCHAR(40) NOT NULL,
  "status" VARCHAR(30) NOT NULL DEFAULT 'OPEN',
  "priority" VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SupportTicket_tenantId_companyId_status_updatedAt_idx" ON "SupportTicket"("tenantId","companyId","status","updatedAt");
CREATE INDEX "SupportTicket_createdById_createdAt_idx" ON "SupportTicket"("createdById","createdAt");

CREATE TABLE "SupportTicketMessage" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupportTicketMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SupportTicketMessage_ticketId_createdAt_idx" ON "SupportTicketMessage"("ticketId","createdAt");
ALTER TABLE "SupportTicketMessage" ADD CONSTRAINT "SupportTicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "BillingInvoice" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "subscriptionId" TEXT,
  "invoiceNumber" VARCHAR(40) NOT NULL,
  "description" VARCHAR(300) NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'INR',
  "status" VARCHAR(20) NOT NULL DEFAULT 'ISSUED',
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dueAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "paymentNote" VARCHAR(300),
  "createdById" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BillingInvoice_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BillingInvoice_invoiceNumber_key" ON "BillingInvoice"("invoiceNumber");
CREATE INDEX "BillingInvoice_tenantId_issuedAt_idx" ON "BillingInvoice"("tenantId","issuedAt");
CREATE INDEX "BillingInvoice_companyId_status_dueAt_idx" ON "BillingInvoice"("companyId","status","dueAt");

CREATE TABLE "PayrollIncentive" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "description" VARCHAR(300) NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PayrollIncentive_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PayrollIncentive_period_user_key" ON "PayrollIncentive"("tenantId","companyId","branchId","userId","year","month");
CREATE INDEX "PayrollIncentive_period_idx" ON "PayrollIncentive"("tenantId","companyId","branchId","year","month");

CREATE TABLE "LeadHistory" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "kind" VARCHAR(30) NOT NULL,
  "note" VARCHAR(1000) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeadHistory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LeadHistory_tenantId_leadId_createdAt_idx" ON "LeadHistory"("tenantId","leadId","createdAt");
