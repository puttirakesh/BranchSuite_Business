/**
 * Prepaid plan validity rules. All arithmetic is UTC and server-side.
 *
 * Calendar-month policy: add N calendar months and keep the day-of-month and
 * time of day; if the target month is shorter, clamp to its last day.
 *   31 Jan + 1 month  -> 28 Feb (29 Feb in a leap year)
 *   29 Feb + 12 months -> 28 Feb of the next year
 *   11 Nov 2026 10:00 + 1 month -> 11 Dec 2026 10:00
 *
 * Known consequence of clamping: renewing from a clamped date does not "snap
 * back" (31 Jan -> 28 Feb -> 28 Mar). This is documented product behaviour.
 */

export type BillingCycle = 'monthly' | 'annual';

export function cycleMonths(cycle: BillingCycle): number {
  return cycle === 'annual' ? 12 : 1;
}

export function addCalendarMonths(date: Date, months: number): Date {
  const day = date.getUTCDate();
  const result = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth() + months,
      1,
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds(),
    ),
  );
  const lastDay = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

/** The instant a subscription's paid access ends (null when none recorded). */
export function effectiveExpiry(subscription: {
  expiresAt: Date | null;
  currentPeriodEnd: Date | null;
}): Date | null {
  const dates = [subscription.expiresAt, subscription.currentPeriodEnd].filter(
    (value): value is Date => value instanceof Date,
  );
  if (!dates.length) return null;
  // The guards deny at the EARLIEST of the two, so that is the real end.
  return new Date(Math.min(...dates.map((value) => value.getTime())));
}

/**
 * Validity granted by one verified captured payment.
 *  - Still active (expiry in the future): early renewal EXTENDS FROM THE
 *    EXISTING EXPIRY, not from the payment date.
 *  - Never paid or already expired: starts at the verified payment time.
 */
export function computeValidity(input: {
  now: Date;
  cycle: BillingCycle;
  currentStatus: string;
  currentExpiry: Date | null;
}): { validFrom: Date; validUntil: Date } {
  const stillActive =
    input.currentStatus === 'ACTIVE' &&
    input.currentExpiry !== null &&
    input.currentExpiry.getTime() > input.now.getTime();
  const validFrom = stillActive ? (input.currentExpiry as Date) : input.now;
  return {
    validFrom,
    validUntil: addCalendarMonths(validFrom, cycleMonths(input.cycle)),
  };
}

/** Whole days left (rounded up); 0 when expired or unknown. */
export function daysRemaining(expiry: Date | null, now = new Date()): number {
  if (!expiry) return 0;
  const ms = expiry.getTime() - now.getTime();
  return ms <= 0 ? 0 : Math.ceil(ms / 86_400_000);
}
