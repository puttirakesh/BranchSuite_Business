import { HttpException, HttpStatus } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';

// Fixed 15-minute windows count all attempts, including unknown accounts and
// successful logins. Reserve before password verification to cover concurrent requests.
export async function throttleLogin(prisma: PrismaService, email: string, ip: string) {
  const key = (kind: string, value: string) => `${kind}:${createHash('sha256').update(value).digest('hex')}`;
  const accountKey = key('account', email.trim().toLowerCase());
  const ipKey = key('ip', ip.replace(/^::ffff:/, '').toLowerCase());
  const counters = await prisma.$queryRaw<{ key: string; attempts: number }[]>`
    INSERT INTO "LoginThrottle" ("key", "attempts", "expiresAt")
    VALUES (${accountKey}, 1, CURRENT_TIMESTAMP + INTERVAL '15 minutes'),
           (${ipKey}, 1, CURRENT_TIMESTAMP + INTERVAL '15 minutes')
    ON CONFLICT ("key") DO UPDATE SET
      "attempts" = CASE WHEN "LoginThrottle"."expiresAt" <= CURRENT_TIMESTAMP
        THEN 1 ELSE LEAST("LoginThrottle"."attempts" + 1, 101) END,
      "expiresAt" = CASE WHEN "LoginThrottle"."expiresAt" <= CURRENT_TIMESTAMP
        THEN CURRENT_TIMESTAMP + INTERVAL '15 minutes' ELSE "LoginThrottle"."expiresAt" END
    RETURNING "key", "attempts"
  `;
  if (counters.some(counter => counter.attempts > (counter.key === accountKey ? 10 : 100))) {
    throw new HttpException('Too many login attempts. Try again in 15 minutes.', HttpStatus.TOO_MANY_REQUESTS);
  }
}
