-- Prepaid one-time payments (Razorpay Orders API) with manual renewal.
-- ADDITIVE ONLY: no table/column is dropped, no data is rewritten.
-- Existing rows keep billingModel = 'RECURRING' (legacy Razorpay Subscriptions).

-- AlterTable: BusinessSubscription
ALTER TABLE "BusinessSubscription"
  ADD COLUMN "billingModel" TEXT NOT NULL DEFAULT 'RECURRING',
  ADD COLUMN "lastPaymentAt" TIMESTAMP(3);

-- AlterTable: SubscriptionPayment
-- providerSubscriptionId becomes optional (one-time payments have no subscription).
-- Dropping NOT NULL is non-destructive; existing values are untouched.
ALTER TABLE "SubscriptionPayment"
  ADD COLUMN "method" TEXT,
  ADD COLUMN "orderId" TEXT,
  ADD COLUMN "providerOrderId" TEXT,
  ALTER COLUMN "providerSubscriptionId" DROP NOT NULL;

-- CreateTable: SubscriptionOrder
CREATE TABLE "SubscriptionOrder" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "subscriptionId" TEXT NOT NULL,
  "purpose" VARCHAR(20) NOT NULL,
  "planId" TEXT NOT NULL,
  "billingCycle" TEXT NOT NULL,
  "amountPaise" INTEGER NOT NULL,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'INR',
  "razorpayOrderId" TEXT NOT NULL,
  "razorpayPaymentId" TEXT,
  "status" VARCHAR(20) NOT NULL DEFAULT 'CREATED',
  "failureCode" TEXT,
  "failureDescription" TEXT,
  "validFrom" TIMESTAMP(3),
  "validUntil" TIMESTAMP(3),
  "appliedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SubscriptionOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionOrder_razorpayOrderId_key" ON "SubscriptionOrder"("razorpayOrderId");
CREATE UNIQUE INDEX "SubscriptionOrder_razorpayPaymentId_key" ON "SubscriptionOrder"("razorpayPaymentId");
CREATE INDEX "SubscriptionOrder_tenantId_status_createdAt_idx" ON "SubscriptionOrder"("tenantId", "status", "createdAt");
CREATE INDEX "SubscriptionOrder_subscriptionId_createdAt_idx" ON "SubscriptionOrder"("subscriptionId", "createdAt");
CREATE INDEX "SubscriptionPayment_providerOrderId_idx" ON "SubscriptionPayment"("providerOrderId");
CREATE INDEX "SubscriptionPayment_orderId_idx" ON "SubscriptionPayment"("orderId");

-- AddForeignKey
ALTER TABLE "SubscriptionPayment"
  ADD CONSTRAINT "SubscriptionPayment_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "SubscriptionOrder"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SubscriptionOrder"
  ADD CONSTRAINT "SubscriptionOrder_subscriptionId_fkey"
  FOREIGN KEY ("subscriptionId") REFERENCES "BusinessSubscription"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
