import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';

// Reuses the existing "LoginThrottle" key/counter table (no schema change) with
// distinct key prefixes. Fixed windows; counters survive restarts and are shared
// by all backend instances.
const logger = new Logger('OtpThrottle');
const limit = (name: string, fallback: number) => {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
};
let warnedProxy = false;

/** Per-IP request budget (default 10 OTP requests per hour). */
export async function throttleOtpIp(prisma: PrismaService, ip?: string) {
  if (!ip) return;
  // Without a trusted-proxy list req.ip is the platform proxy for every user, so
  // a per-IP budget would lock everyone out together. Skip it and say so once.
  if (!process.env.TRUSTED_PROXY_CIDRS?.trim()) {
    if (!warnedProxy) {
      warnedProxy = true;
      logger.warn('TRUSTED_PROXY_CIDRS is unset; per-IP OTP throttling is disabled (global send budget still applies)');
    }
    return;
  }
  const key = `otp-ip:${createHash('sha256').update(ip.replace(/^::ffff:/, '').toLowerCase()).digest('hex')}`;
  let attempts: number;
  try {
    const rows = await prisma.$queryRaw<{ attempts: number }[]>`
      INSERT INTO "LoginThrottle" ("key", "attempts", "expiresAt")
      VALUES (${key}, 1, CURRENT_TIMESTAMP + INTERVAL '1 hour')
      ON CONFLICT ("key") DO UPDATE SET
        "attempts" = CASE WHEN "LoginThrottle"."expiresAt" <= CURRENT_TIMESTAMP
          THEN 1 ELSE LEAST("LoginThrottle"."attempts" + 1, 100000) END,
        "expiresAt" = CASE WHEN "LoginThrottle"."expiresAt" <= CURRENT_TIMESTAMP
          THEN CURRENT_TIMESTAMP + INTERVAL '1 hour' ELSE "LoginThrottle"."expiresAt" END
      RETURNING "attempts"`;
    attempts = Number(rows?.[0]?.attempts ?? 0);
  } catch {
    logger.error('OTP IP throttle unavailable; allowing request');
    return;
  }
  if (attempts > limit('OTP_IP_HOURLY_LIMIT', 10)) {
    throw new HttpException('Too many OTP requests. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
  }
}

/** Global send budget (default 300 per day) protecting the single Gmail sender. */
export async function reserveOtpSendBudget(prisma: PrismaService) {
  let attempts: number;
  try {
    const rows = await prisma.$queryRaw<{ attempts: number }[]>`
      INSERT INTO "LoginThrottle" ("key", "attempts", "expiresAt")
      VALUES ('otp-global:send', 1, CURRENT_TIMESTAMP + INTERVAL '1 day')
      ON CONFLICT ("key") DO UPDATE SET
        "attempts" = CASE WHEN "LoginThrottle"."expiresAt" <= CURRENT_TIMESTAMP
          THEN 1 ELSE LEAST("LoginThrottle"."attempts" + 1, 100000) END,
        "expiresAt" = CASE WHEN "LoginThrottle"."expiresAt" <= CURRENT_TIMESTAMP
          THEN CURRENT_TIMESTAMP + INTERVAL '1 day' ELSE "LoginThrottle"."expiresAt" END
      RETURNING "attempts"`;
    attempts = Number(rows?.[0]?.attempts ?? 0);
  } catch {
    logger.error('OTP global budget unavailable; allowing request');
    return;
  }
  if (attempts > limit('OTP_GLOBAL_DAILY_LIMIT', 300)) {
    throw new HttpException('OTP delivery is temporarily unavailable. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
  }
}
