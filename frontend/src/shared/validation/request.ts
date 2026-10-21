import { validateInput, type InputValidation } from './input';

type Fields = Record<string, InputValidation>;
export class InputValidationError extends Error {
  constructor(message: string) { super(message); this.name = 'InputValidationError'; }
}
const text = (maxLength: number, required = false, minLength = 1): InputValidation => ({ kind: 'text', maxLength, required, minLength });
const email: InputValidation = { kind: 'email', maxLength: 254 };
const phone: InputValidation = { kind: 'phone', maxLength: 10 };
const password: InputValidation = { kind: 'password', minLength: 8, maxLength: 128, required: true };
const money = (required = false, wholeDigits = 12): InputValidation => ({ kind: 'decimal', wholeDigits, maxLength: wholeDigits + 3, min: 0, required });
const integer = (min: number, max: number): InputValidation => ({ kind: 'integer', min, max, required: true });
const contact: Fields = { name: text(150, true), email, phone, address: text(500), notes: text(2000) };
const code = (maxLength: number): InputValidation => ({ ...text(maxLength), pattern: new RegExp(`^[A-Za-z0-9_-]{2,${maxLength}}$`), patternMessage: `Use 2–${maxLength} letters, digits, underscores or hyphens.` });

function checkFields(body: Record<string, unknown>, fields: Fields, partial = false, prefix = '') {
  for (const [key, rule] of Object.entries(fields)) {
    if (partial && !(key in body)) continue;
    const value = body[key];
    const name = key.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
    const label = prefix ? `${prefix}${name}` : name.charAt(0).toUpperCase() + name.slice(1);
    if (value !== undefined && value !== null && typeof value !== 'string' && typeof value !== 'number') throw new InputValidationError(`${label}: Enter a valid value.`);
    const error = validateInput(value === undefined || value === null ? '' : String(value), rule, label);
    if (error) throw new InputValidationError(error.startsWith(label) ? error : `${label}: ${error}`);
  }
}

/** Validate before sending, including untouched fields and values restored from storage. */
export function validateManualRequest(url: string, method: string, data: unknown): void {
  if (!['post', 'put', 'patch'].includes(method.toLowerCase()) || !data || typeof data !== 'object' || Array.isArray(data)) return;
  const body = data as Record<string, unknown>;
  const route = url.split('?')[0].replace(/\/$/, '');
  const partial = method.toLowerCase() === 'patch';
  const check = (fields: Fields, patch = partial) => checkFields(body, fields, patch);
  if (route === '/auth/signup') check({ businessName: text(150, true), branchName: text(150, true, 2), ownerName: text(150, true), email: { ...email, required: true }, phone: { ...phone, required: true }, password }, false);
  else if (route === '/auth/login') check({ email: { ...email, required: true }, password: { ...password, minLength: 1 } }, false);
  else if (route === '/auth/forgot-password') check({ email: { ...email, required: true } }, false);
  else if (route === '/auth/reset-password') check({ token: { ...text(64, true), pattern: /^[a-fA-F0-9]{64}$/, patternMessage: 'Enter the 64-character reset token from your email.' }, newPassword: password, confirmPassword: { ...password, matches: String(body.newPassword ?? '') } }, false);
  else if (/^\/users(?:\/[^/]+)?$/.test(route)) check({ name: text(150, true), email: { ...email, required: true }, phone, ...(!partial ? { password } : {}) });
  else if (/^\/(?:customers|leads)(?:\/[^/]+)?$/.test(route)) {
    check({ ...contact, ...(route.startsWith('/leads') ? { contactPerson: text(150), source: text(100), estimatedValue: money(false, 16) } : {}) });
    if (body.opportunity && typeof body.opportunity === 'object') checkFields(body.opportunity as Record<string, unknown>, { title: text(200, true), amount: money(false, 16) });
  }
  else if (/^\/branches(?:\/[^/]+)?$/.test(route)) check({ name: text(150, true), code: code(20), location: text(240), manager: text(150) });
  else if (/^\/companies(?:\/[^/]+)?$/.test(route)) check({ name: text(150, true) });
  else if (/^\/companies\/[^/]+\/employee-numbering$/.test(route)) check({ prefix: { ...text(12, true), pattern: /^[A-Z][A-Z0-9]{0,11}$/, patternMessage: 'Start with a letter; use up to 12 uppercase letters or digits.' }, nextNumber: integer(1, 1999999999) });
  else if (/^\/employees(?:\/[^/]+)?$/.test(route)) check({ department: text(100), designation: text(100), workEmail: email, notes: text(1000) });
  else if (/^\/deals(?:\/[^/]+)?$/.test(route)) check({ title: text(200, true), amount: money(false, 16), notes: text(3000) });
  else if (/^\/deals\/[^/]+\/transition$/.test(route) && body.stage === 'LOST') check({ lossReason: text(1000, true) }, false);
  else if (/^\/quotes(?:\/[^/]+)?$/.test(route)) {
    check({ title: text(180, true), notes: text(2500) }, false);
    if (!Array.isArray(body.items) || !body.items.length) throw new InputValidationError('Add at least one quotation item.');
    body.items.forEach((item, index) => {
      if (!item || typeof item !== 'object') throw new InputValidationError('Enter valid quotation items.');
      checkFields(item, { description: text(300, true), quantity: integer(1, 1000000), unitPrice: money(true, 14) }, false, `Item ${index + 1} `);
    });
  }
  else if (/^\/leads\/[^/]+\/history$/.test(route)) check({ note: text(1000, true) }, false);
  else if (/^\/activities(?:\/[^/]+)?$/.test(route)) check({ title: text(150, true), description: text(2000) });
  else if (/^\/tasks(?:\/[^/]+)?$/.test(route)) check({ title: text(150, true), description: text(5000) });
  else if (/^\/tasks\/[^/]+\/comments$/.test(route)) check({ message: text(2000, true) }, false);
  else if (route === '/advances') check({ amount: { ...money(true), min: 0.01 }, reason: text(1000, true, 3) }, false);
  else if (/^\/advances\/[^/]+\/(?:approve|reject)$/.test(route)) check({ note: text(1000) });
  else if (route === '/attendance/corrections') check({ reason: text(1000, true) }, false);
  else if (/^\/attendance\/corrections\/[^/]+\/(?:approve|reject)$/.test(route)) check({ note: text(1000, route.endsWith('/reject')) }, false);
  else if (route === '/leave/types') check({ code: { ...text(30, true), pattern: /^[A-Za-z0-9_-]{1,30}$/, patternMessage: 'Use up to 30 letters, digits, underscores or hyphens.' }, name: text(100, true), annualAllowance: integer(0, 366) }, false);
  else if (route === '/leave/balances/allocate') check({ year: integer(2000, 2100), allocatedDays: integer(0, 366) }, false);
  else if (route === '/leave/requests') check({ reason: text(2000, true) }, false);
  else if (/^\/leave\/requests\/[^/]+\/(?:approve|reject)$/.test(route)) check({ note: text(2000) });
  else if (route === '/payroll/employee-salaries/revise') {
    check({ gross: money(true), deductions: money(true), reason: text(500, true) }, false);
    if (Number(body.deductions) > Number(body.gross)) throw new InputValidationError('Deductions cannot exceed gross earnings.');
  }
  else if (route === '/payroll/incentives') check({ amount: money(true), description: text(300, true) }, false);
  else if (route === '/payroll/salary-structures') {
    check({ name: text(100, true), basicAmount: money(true) }, false);
    if (Array.isArray(body.components)) body.components.forEach(component => checkFields(component, { code: text(30, true), name: text(100, true), amount: money(true) }));
  }
  else if (/^\/payroll\/entries\/[^/]+\/pay$/.test(route)) check({ reference: text(150) });
  else if (route === '/employee-documents') check({ title: text(180, true, 2), content: text(20000, true) }, false);
  else if (route === '/support/tickets') check({ subject: text(180, true, 4), message: text(10000, true, 10) }, false);
  else if (/^\/support\/tickets\/[^/]+\/messages$/.test(route)) check({ message: text(10000, true) }, false);
  else if (route === '/billing/invoices') check({ description: text(300, true, 3), amount: { ...money(true), min: 0.01 } }, false);
  else if (/^\/billing\/invoices\/[^/]+\/record-payment$/.test(route)) check({ note: text(300, true, 2) }, false);
}
