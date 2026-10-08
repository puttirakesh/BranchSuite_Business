import { z } from 'zod';

export const inputLimits = {
  name: 160, email: 254, password: 1024, phone: 32, organization: 160,
  source: 100, notes: 4000, description: 500, search: 160, id: 128,
  items: 100, money: 1e12, quantity: 1e6,
} as const;
// Supported currencies for this application's two-decimal monetary forms.
export const supportedCurrencies = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'AUD', 'CAD', 'SGD', 'CHF', 'CNY', 'NZD', 'SAR'] as const;
const singleLineControls = /[\u0000-\u001F\u007F-\u009F]/;
const multilineControls = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/;
export type FieldErrors = Record<string, string>;
export class InputValidationError extends Error {
  constructor(public readonly errors: FieldErrors) {
    super(Object.values(errors)[0] || 'Check your input and try again.');
    this.name = 'InputValidationError';
  }
}
export function textError(raw: string, label: string, max: number, required = false, multiline = false): string | undefined {
  const value = raw.trim();
  if (required && !value) return `${label} is required.`;
  if (raw.length > max) return `Use at most ${max} characters.`;
  if ((multiline ? multilineControls : singleLineControls).test(raw)) return `${label} contains unsupported control characters.`;
}
export function emailError(raw: string, required = false): string | undefined {
  const error = textError(raw, 'Email address', inputLimits.email, required);
  if (error) return error;
  if (raw.trim() && !z.string().email().safeParse(raw.trim()).success) return 'Enter a valid email address.';
}
export function phoneError(raw: string): string | undefined {
  const error = textError(raw, 'Phone number', inputLimits.phone);
  if (error) return error;
  const value = raw.trim();
  if (!value) return;
  const digits = value.replace(/\D/g, '');
  if (!/^\+?[\d\s().-]+$/.test(value) || digits.length < 7 || digits.length > 15) return 'Enter 7–15 digits, with an optional leading + and formatting separators.';
  let depth = 0;
  for (const character of value) {
    if (character === '(' && ++depth > 1) return 'Check the parentheses in the phone number.';
    if (character === ')' && --depth < 0) return 'Check the parentheses in the phone number.';
  }
  if (depth || /\([^\d]*\)/.test(value)) return 'Check the parentheses in the phone number.';
}
export function identifierError(raw: string, label: string, required = false): string | undefined {
  if (!raw && !required) return;
  if (!raw || raw.length > inputLimits.id || /[\s\u0000-\u001F\u007F-\u009F]/.test(raw)) return `Choose a valid ${label.toLowerCase()}.`;
}
export function decimalError(raw: string, label: string, max: number, decimals: number, positive = false): string | undefined {
  const invalidText = textError(raw, label, 32, true);
  if (invalidText) return invalidText;
  const value = raw.trim();
  if (!new RegExp(`^\\d+(?:\\.\\d{1,${decimals}})?$`).test(value)) return `Enter ${positive ? 'a positive' : 'a non-negative'} number with up to ${decimals} decimal places.`;
  const number = Number(value);
  if (!Number.isFinite(number) || number > max || (positive && number <= 0)) return `${label} must be ${positive ? 'greater than 0' : 'at least 0'} and no more than ${max.toLocaleString('en-IN')}.`;
}
export function dateError(raw: string): string | undefined {
  const invalidText = textError(raw, 'Date', 32);
  if (invalidText) return invalidText;
  const value = raw.trim();
  if (!value) return;
  const date = new Date(`${value}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000') || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return 'Use a valid date in YYYY-MM-DD format.';
}
export function validateSearch(raw: string) {
  return { value: raw.trim(), error: textError(raw, 'Search', inputLimits.search) };
}
export function validateLogin(email: string, password: string) {
  const errors: FieldErrors = {};
  const invalidEmail = emailError(email, true);
  if (invalidEmail) errors.email = invalidEmail;
  const invalidPassword = textError(password, 'Password', inputLimits.password, true);
  if (invalidPassword) errors.password = invalidPassword;
  return { errors, input: Object.keys(errors).length ? undefined : { email: email.trim(), password } };
}
