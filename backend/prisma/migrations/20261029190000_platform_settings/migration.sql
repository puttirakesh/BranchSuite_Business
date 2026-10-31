BEGIN;
CREATE TABLE "PlatformSetting" (
  "key" VARCHAR(80) NOT NULL PRIMARY KEY,
  "value" JSONB NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "updatedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "PlatformSettingChange" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "settingKey" VARCHAR(80) NOT NULL,
  "actorId" TEXT NOT NULL,
  "changes" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "PlatformSettingChange_settingKey_createdAt_idx" ON "PlatformSettingChange"("settingKey", "createdAt");
COMMIT;
