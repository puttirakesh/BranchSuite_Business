import { parseCalendarDate } from './date';

export type InputKind = 'text' | 'name' | 'email' | 'phone' | 'integer' | 'decimal' | 'date' | 'time' | 'code' | 'password' | 'search';
export type InputValidation = {
  kind?: InputKind;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  fractionDigits?: number;
  wholeDigits?: number;
  pattern?: RegExp;
  patternMessage?: string;
  matches?: string;
  startsWith?: 'letter' | 'digit' | 'alphanumeric';
};

/** Leave a trailing word separator while editing; normalize the completed value. */
export function normalizeInput(value: string, rule: InputValidation, editing = false): string {
  if (rule.kind === 'password') return value;
  return editing && (!rule.kind || ['text', 'name', 'search', 'time'].includes(rule.kind)) ? value.trimStart() : value.trim();
}

function validStart(value: string, rule: InputValidation): boolean {
  const start = rule.startsWith ?? (rule.kind === 'name' ? 'letter' : rule.kind === 'date' || rule.kind === 'time' ? 'digit' : undefined);
  return !value || !start || (start === 'letter' ? /^\p{L}/u : start === 'digit' ? /^\d/ : /^[\p{L}\d]/u).test(value);
}

// Unquoted mailbox addresses with DNS domains. Plus addressing and subdomains are valid.
export function isEmail(value: string): boolean {
  if (value.length > 254 || /\s/.test(value)) return false;
  const parts = value.split('@');
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  return local.length > 0 && local.length <= 64 && !local.startsWith('.') && !local.endsWith('.') && !local.includes('..')
    && /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local)
    && domain.length <= 253 && domain.includes('.')
    && domain.split('.').every(part => /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/.test(part))
    && !/^\d+$/.test(domain.split('.').at(-1)!);
}

export function keyboardInputKind(keyboard?: string): InputKind {
  if (keyboard === 'phone-pad') return 'phone';
  if (keyboard === 'email-address') return 'email';
  if (keyboard === 'number-pad' || keyboard === 'numeric') return 'integer';
  if (keyboard === 'decimal-pad') return 'decimal';
  return 'text';
}

export function inputLimit(rule: InputValidation): number {
  return rule.maxLength ?? (rule.kind === 'email' ? 254 : rule.kind === 'phone' ? 10 : rule.kind === 'password' ? 128 : rule.kind === 'integer' ? 10 : rule.kind === 'decimal' ? (rule.wholeDigits ?? 12) + 3 : rule.kind === 'search' ? 100 : 2000);
}

/** Restrict typing and paste without turning malformed amounts such as 1e3 into 13. */
export function acceptsInput(value: string, rule: InputValidation, multiline = false): boolean {
  value = normalizeInput(value, rule, true);
  if (value.length > inputLimit(rule)) return false;
  if (rule.kind === 'password') return true; // Never trim or rewrite credentials.
  if (!validStart(value, rule)) return false;
  if (rule.kind === 'email') return !/\s/.test(value) && (!value || /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]/.test(value));
  if (rule.kind === 'date') return /^[\d/-]*$/.test(value);
  if (rule.kind === 'time') return /^[\d: APMapm]*$/.test(value);
  if (rule.kind === 'phone' || rule.kind === 'integer') return /^\d*$/.test(value);
  if (rule.kind === 'decimal') return value === '' || new RegExp(`^\\d{1,${rule.wholeDigits ?? 12}}(?:\\.\\d{0,${rule.fractionDigits ?? 2}})?$`).test(value);
  return !(multiline ? /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/ : /[\u0000-\u001F\u007F]/).test(value);
}

export function validateInput(raw: string, rule: InputValidation, label = 'This field'): string | undefined {
  const value = normalizeInput(raw, rule);
  if (rule.kind === 'email' && value && !isEmail(value)) return 'Enter a valid email address, such as name@company.com.';
  if (rule.kind === 'password' && raw.length && !raw.trim()) return 'Password must contain a non-space character.';
  if (!value) return rule.required ? `${label} is required.` : undefined;
  if (!validStart(value, rule)) return `Start with ${rule.startsWith === 'digit' || rule.kind === 'date' || rule.kind === 'time' ? 'a digit' : rule.startsWith === 'alphanumeric' ? 'a letter or digit' : 'a letter'}.`;
  if (value.length > inputLimit(rule)) return `Use ${inputLimit(rule)} characters or fewer.`;
  if (rule.minLength !== undefined && value.length < rule.minLength) return `Use at least ${rule.minLength} characters.`;
  if (rule.kind !== 'password' && /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value)) return 'Remove unsupported control characters.';
  if (rule.kind === 'phone' && !new RegExp(`^\\d{${rule.maxLength ?? 10}}$`).test(value)) return `Enter exactly ${rule.maxLength ?? 10} digits.`;
  if (rule.kind === 'date') {
    const display = /^(\d{2})[/-](\d{2})[/-](\d{4})$/.exec(value);
    const dateKey = display ? `${display[3]}-${display[2]}-${display[1]}` : /^\d{4}-\d{2}$/.test(value) ? `${value}-01` : value;
    if (!parseCalendarDate(dateKey)) return 'Enter a valid calendar date.';
  }
  if (rule.kind === 'time' && !/^(?:0?[1-9]|1[0-2]):[0-5]\d (?:AM|PM)$/i.test(value)) return 'Use a time such as 9:00 AM.';
  if (rule.kind === 'integer' || rule.kind === 'decimal') {
    const pattern = rule.kind === 'integer' ? /^\d+$/ : new RegExp(`^\\d{1,${rule.wholeDigits ?? 12}}(?:\\.\\d{1,${rule.fractionDigits ?? 2}})?$`);
    if (!pattern.test(value)) return rule.kind === 'integer' ? 'Enter a whole number using digits only.' : `Enter a number with up to ${rule.fractionDigits ?? 2} decimal places.`;
    const number = Number(value);
    if (!Number.isFinite(number) || (rule.kind === 'integer' && !Number.isSafeInteger(number))) return 'Enter a number within the supported range.';
    if (rule.min !== undefined && number < rule.min) return `Enter a value of at least ${rule.min}.`;
    if (rule.max !== undefined && number > rule.max) return `Enter a value no greater than ${rule.max}.`;
  }
  if (rule.pattern && !new RegExp(rule.pattern.source, rule.pattern.flags.replace(/[gy]/g, '')).test(value)) return rule.patternMessage ?? 'Enter a valid value.';
  if (rule.matches !== undefined && raw !== rule.matches) return 'The values do not match.';
  return undefined;
}
