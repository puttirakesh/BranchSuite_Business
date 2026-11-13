import { componentCode, type SalaryComponentInput } from './payroll-structure';

/** Codes the product already seeds for statutory deductions. No rule is configured for them (see the backend). */
export const STATUTORY_CODES = ['PROVIDENT_FUND', 'PROFESSIONAL_TAX', 'ESI', 'TDS'] as const;

export const isStatutoryComponent = (item: SalaryComponentInput) => item.kind === 'DEDUCTION' && STATUTORY_CODES.includes((item.code ?? '') as typeof STATUTORY_CODES[number]);

const grossPattern = /^\d{1,12}(\.\d{1,2})?$/;
export const isValidGross = (value: string) => grossPattern.test(value.trim()) && Number(value) > 0;

/** "Provident Fund (manual)" -> "Provident Fund": the "(manual)" suffix is replaced by the explicit not-configured state. */
export const displayComponentName = (name: string) => name.replace(/\s*\(manual\)\s*$/i, '').trim() || 'Component';

/** Only components the user filled in are sent to the preview; blanks are "not entered", never silently zero. */
export function breakdownRequestComponents(components: SalaryComponentInput[]) {
  return components
    .filter(item => item.amount.trim() !== '' && Number(item.amount) > 0)
    .map(item => ({ code: item.code?.trim().toUpperCase() || componentCode(item.name), name: item.name.trim(), kind: item.kind, amount: item.amount.trim() }));
}

export const formatInr = (value: string | number) => `₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
