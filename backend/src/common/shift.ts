import { BUSINESS_TIMEZONE } from './business-time';

export const SHIFT_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const minutesOf = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));

function businessMinuteOfDay(timestamp: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: BUSINESS_TIMEZONE,
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(timestamp);
  const value = (type: string) => Number(parts.find(part => part.type === type)!.value);
  return value('hour') * 60 + value('minute');
}

/** Minutes after the branch shift start, or 0 when on time, within grace, or no shift is configured. */
export function lateMinutes(branch: { shiftStart: string | null; graceMinutes: number }, checkInAt: Date | null): number {
  if (!branch.shiftStart || !checkInAt) return 0;
  const late = businessMinuteOfDay(checkInAt) - minutesOf(branch.shiftStart);
  return late > branch.graceMinutes ? late : 0;
}
