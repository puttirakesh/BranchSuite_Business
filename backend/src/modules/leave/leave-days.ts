import type { PayrollCalendar } from '../payroll/payroll-calculation';

/** Leave days between two UTC date-only values, skipping the company's weekly offs and holidays. */
export function workingLeaveDays(start: Date, end: Date, calendar: PayrollCalendar | null): number {
  const weeklyOff = new Set(calendar?.weeklyOffDays ?? []);
  const holidays = new Set(calendar?.holidays ?? []);
  let days = 0;
  for (let instant = start.getTime(); instant <= end.getTime(); instant += 86400000) {
    const date = new Date(instant);
    if (!weeklyOff.has(date.getUTCDay()) && !holidays.has(date.toISOString().slice(0, 10))) days += 1;
  }
  return days;
}
