/** Date helpers for plain YYYY-MM-DD strings (UTC, so no time-zone drift). */
export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function today(): string {
  return new Date().toISOString().slice(0, 10);
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
