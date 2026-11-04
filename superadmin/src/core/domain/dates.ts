/** Date helpers for plain YYYY-MM-DD strings (UTC, so no time-zone drift). */
export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function today(): string {
  return calendarDateKey(new Date());
}

/** Local calendar components, never UTC conversion of a local midnight. */
export function calendarDateKey(date: Date): string {
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function parseCalendarDate(value: string): Date | null {
  if (!isValidIsoDate(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setHours(12, 0, 0, 0);
  date.setFullYear(year!, month! - 1, day!);
  return date;
}

export function calendarRangeError(min?: string, max?: string): string | undefined {
  if ((min && !isValidIsoDate(min)) || (max && !isValidIsoDate(max))) return 'Invalid date boundary.';
  if (min && max && min > max) return 'End date must be on or after start date.';
  return undefined;
}

export function isAllowedCalendarDate(value: string, min?: string, max?: string): boolean {
  return isValidIsoDate(value) && !calendarRangeError(min, max) && (!min || value >= min) && (!max || value <= max);
}

export function formatCalendarDate(value: string): string {
  return parseCalendarDate(value)?.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) ?? '';
}

export function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const date = new Date(value + 'T12:00:00Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function addDays(value: string, days: number): string {
  const date = new Date(value + 'T12:00:00Z');
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
