CREATE TABLE "OtpChallenge" (
 "id" TEXT NOT NULL, "purpose" TEXT NOT NULL, "channel" TEXT NOT NULL,
 "destination" TEXT NOT NULL, "userId" TEXT, "codeHash" TEXT NOT NULL,
 "attempts" INTEGER NOT NULL DEFAULT 0, "expiresAt" TIMESTAMP(3) NOT NULL,
 "verifiedAt" TIMESTAMP(3), "usedAt" TIMESTAMP(3),
 "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "OtpChallenge_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OtpChallenge_purpose_channel_destination_key" ON "OtpChallenge"("purpose", "channel", "destination");
CREATE INDEX "OtpChallenge_expiresAt_idx" ON "OtpChallenge"("expiresAt");
