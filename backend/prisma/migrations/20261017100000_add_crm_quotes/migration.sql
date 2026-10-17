CREATE TABLE "Quote" (
 "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "companyId" TEXT NOT NULL,
 "branchId" TEXT, "dealId" TEXT NOT NULL, "createdById" TEXT NOT NULL,
 "title" TEXT NOT NULL, "notes" TEXT, "currency" VARCHAR(3) NOT NULL DEFAULT 'INR',
 "total" DECIMAL(18,2) NOT NULL, "status" TEXT NOT NULL DEFAULT 'DRAFT',
 "version" INTEGER NOT NULL DEFAULT 1, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Quote_tenantId_companyId_branchId_idx" ON "Quote"("tenantId","companyId","branchId");
CREATE INDEX "Quote_dealId_createdAt_idx" ON "Quote"("dealId","createdAt");
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TABLE "QuoteItem" (
 "id" TEXT NOT NULL,"quoteId" TEXT NOT NULL,"position" INTEGER NOT NULL,
 "description" TEXT NOT NULL,"quantity" INTEGER NOT NULL,
 "unitPrice" DECIMAL(18,2) NOT NULL,"lineTotal" DECIMAL(18,2) NOT NULL,
 CONSTRAINT "QuoteItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "QuoteItem_quoteId_position_key" ON "QuoteItem"("quoteId","position");
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
