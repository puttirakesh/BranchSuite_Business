-- Additive migration: no changes to existing business tables.
CREATE TABLE "MarketingOffer" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "description" VARCHAR(1000) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "discountType" VARCHAR(12) NOT NULL,
    "discountValue" DECIMAL(12,2) NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT,
    "companyId" TEXT,
    "usageLimit" INTEGER,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MarketingOffer_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MarketingOffer_code_key" ON "MarketingOffer"("code");
CREATE INDEX "MarketingOffer_status_startsAt_endsAt_idx" ON "MarketingOffer"("status", "startsAt", "endsAt");
CREATE INDEX "MarketingOffer_tenantId_companyId_idx" ON "MarketingOffer"("tenantId", "companyId");
CREATE INDEX "MarketingOffer_createdAt_idx" ON "MarketingOffer"("createdAt");

CREATE TABLE "MarketingOfferChange" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" VARCHAR(30) NOT NULL,
    "changes" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MarketingOfferChange_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MarketingOfferChange_offerId_createdAt_idx" ON "MarketingOfferChange"("offerId", "createdAt");
ALTER TABLE "MarketingOfferChange" ADD CONSTRAINT "MarketingOfferChange_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "MarketingOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
