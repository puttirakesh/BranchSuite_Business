// Business dates are stored as UTC date-only values; timestamps stay UTC.
export const BUSINESS_TIMEZONE = 'Asia/Kolkata';
export function businessDateKey(timestamp: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: BUSINESS_TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(timestamp);
  const value = (type: string) => parts.find(part => part.type === type)!.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}
export function businessToday(timestamp: Date = new Date()): Date {
  return new Date(`${businessDateKey(timestamp)}T00:00:00.000Z`);
}
