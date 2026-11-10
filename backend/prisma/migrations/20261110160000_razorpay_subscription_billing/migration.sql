ALTER TYPE "SubscriptionStatus" ADD VALUE 'PAST_DUE';

ALTER TABLE "BusinessSubscription"
  ADD COLUMN "razorpaySubscriptionId" TEXT,
  ADD COLUMN "providerStatus" TEXT,
  ADD COLUMN "providerCheckoutUrl" TEXT,
  ADD COLUMN "activatedAt" TIMESTAMP(3),
  ADD COLUMN "currentPeriodStart" TIMESTAMP(3),
  ADD COLUMN "currentPeriodEnd" TIMESTAMP(3),
  ADD COLUMN "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "expiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "BusinessSubscription_razorpaySubscriptionId_key"
  ON "BusinessSubscription"("razorpaySubscriptionId");

CREATE TABLE "SubscriptionPayment" (
  "id" TEXT NOT NULL,
  "subscriptionId" TEXT NOT NULL,
  "providerPaymentId" TEXT NOT NULL,
  "providerSubscriptionId" TEXT NOT NULL,
  "amountPaise" INTEGER NOT NULL,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'INR',
  "status" VARCHAR(30) NOT NULL,
  "failureCode" TEXT,
  "failureDescription" TEXT,
  "capturedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SubscriptionPayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SubscriptionPayment_providerPaymentId_key"
  ON "SubscriptionPayment"("providerPaymentId");
CREATE INDEX "SubscriptionPayment_subscriptionId_createdAt_idx"
  ON "SubscriptionPayment"("subscriptionId", "createdAt");
CREATE INDEX "SubscriptionPayment_providerSubscriptionId_status_idx"
  ON "SubscriptionPayment"("providerSubscriptionId", "status");

ALTER TABLE "SubscriptionPayment"
  ADD CONSTRAINT "SubscriptionPayment_subscriptionId_fkey"
  FOREIGN KEY ("subscriptionId") REFERENCES "BusinessSubscription"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "RazorpayWebhookEvent" (
  "id" TEXT NOT NULL,
  "providerEventId" TEXT NOT NULL,
  "eventType" VARCHAR(100) NOT NULL,
  "payload" JSONB NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "lastError" TEXT,
  CONSTRAINT "RazorpayWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RazorpayWebhookEvent_providerEventId_key"
  ON "RazorpayWebhookEvent"("providerEventId");
CREATE INDEX "RazorpayWebhookEvent_eventType_receivedAt_idx"
  ON "RazorpayWebhookEvent"("eventType", "receivedAt");
CREATE INDEX "RazorpayWebhookEvent_processedAt_receivedAt_idx"
  ON "RazorpayWebhookEvent"("processedAt", "receivedAt");
