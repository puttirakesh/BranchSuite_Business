/** Parse a local calendar date without UTC conversion or JavaScript's year 0–99 shortcut. */
export function parseCalendarDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(0);
  date.setHours(0, 0, 0, 0);
  date.setFullYear(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

export function calendarDateKey(date: Date): string {
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function calendarRangeError(minimum?: string, maximum?: string): string | undefined {
  if ((minimum && !parseCalendarDate(minimum)) || (maximum && !parseCalendarDate(maximum))) return 'The allowed date range is invalid.';
  if (minimum && maximum && minimum > maximum) return 'The minimum date must be on or before the maximum date.';
  return undefined;
}

export function isAllowedCalendarDate(value: string, minimum?: string, maximum?: string): boolean {
  return !!parseCalendarDate(value) && !calendarRangeError(minimum, maximum) && (!minimum || value >= minimum) && (!maximum || value <= maximum);
}
