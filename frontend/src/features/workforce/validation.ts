import type { Field } from './types';

export function isDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function isTimestamp(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.test(value)
    && isDate(value.slice(0, 10)) && !Number.isNaN(Date.parse(value));
}
export function validate(fields: Field[], values: Record<string, string>): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    const value = (values[field.key] ?? '').trim();
    if (!value) { if (field.required) errors[field.key] = `${field.label} is required.`; continue; }
    const maximum = field.maxLength ?? 2000;
    if (value.length > maximum) errors[field.key] = `Use no more than ${maximum.toLocaleString('en-US')} characters.`;
    else if (field.kind === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) errors[field.key] = 'Enter a valid email address.';
    else if (field.kind === 'phone' && (!/^\+?[\d ()-]+$/.test(value) || value.replace(/\D/g, '').length < 7 || value.replace(/\D/g, '').length > 15)) errors[field.key] = 'Enter a phone number with 7–15 digits, optionally starting with +.';
    else if (field.kind === 'date' && !isDate(value)) errors[field.key] = 'Use a valid date in YYYY-MM-DD format.';
    else if (field.kind === 'datetime' && !isTimestamp(value)) errors[field.key] = 'Use a valid date and time with a timezone, such as 2026-10-07T09:00:00+05:30.';
    else if (field.kind === 'money' && !/^\d+(\.\d{1,2})?$/.test(value)) errors[field.key] = 'Enter a non-negative amount with up to two decimal places.';
    else if (field.options && !field.options.includes(value)) errors[field.key] = 'Choose one of the listed options.';
    else if (field.key === 'currency' && !/^[A-Z]{3}$/.test(value)) errors[field.key] = 'Use a three-letter uppercase currency code, such as INR.';
  }
  for (const [start, end] of [['startDate', 'endDate'], ['periodStart', 'periodEnd']]) {
    if (values[start] && values[end] && !errors[start] && !errors[end] && values[end] < values[start]) errors[end] = 'The end date must be on or after the start date.';
  }
  if (values.checkIn && values.checkOut && !errors.checkIn && !errors.checkOut && Date.parse(values.checkOut) < Date.parse(values.checkIn)) errors.checkOut = 'Check-out must be after check-in.';
  return errors;
}
export function payload(fields: Field[], values: Record<string, string>): Record<string, string | null> {
  // Scope, role, status transitions and computed amounts are never copied from a record into a write.
  return Object.fromEntries(fields.map(field => [field.key, values[field.key]?.trim() || null]));
}
