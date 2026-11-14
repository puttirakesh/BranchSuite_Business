import { componentCode, parseSalaryStructure, type SalaryComponentInput } from './payroll-structure';

/** Codes the product already seeds for statutory deductions. No rule is configured for them (see the backend). */
export const STATUTORY_CODES = ['PROVIDENT_FUND', 'PROFESSIONAL_TAX', 'ESI', 'TDS'] as const;

export const isStatutoryComponent = (item: SalaryComponentInput) => item.kind === 'DEDUCTION' && STATUTORY_CODES.includes((item.code ?? '') as typeof STATUTORY_CODES[number]);

const grossPattern = /^\d{1,12}(\.\d{1,2})?$/;
export const isValidGross = (value: string) => grossPattern.test(value.trim()) && Number(value) > 0;

function amountCents(value: string, label: string): number {
  const text = value.trim();
  if (!text) return 0;
  if (!grossPattern.test(text)) throw new Error(`${label} must be a non-negative amount with up to two decimal places.`);
  const cents = Math.round(Number(text) * 100);
  if (!Number.isSafeInteger(cents)) throw new Error(`${label} is too large.`);
  return cents;
}

/** Onboarding preview uses the same balancing rules as the backend; the save endpoint validates the final structure. */
export function estimateSalaryBreakdown(grossAmount: string, inputComponents: SalaryComponentInput[]) {
  if (!isValidGross(grossAmount)) throw new Error('Monthly gross salary must be greater than zero.');
  const grossCents = amountCents(grossAmount, 'Monthly gross salary');
  const earningsCents = inputComponents.reduce(
    (total, component) => total + (component.kind === 'EARNING' ? amountCents(component.amount, component.name || 'Component amount') : 0),
    0,
  );
  const basicCents = grossCents - earningsCents;
  if (basicCents <= 0) throw new Error('Allowances must be less than the monthly gross salary so a positive basic salary remains.');
  const structure = parseSalaryStructure((basicCents / 100).toFixed(2), inputComponents);
  const components = structure.components;
  const allowancesCents = components.reduce(
    (total, component) => total + (component.kind === 'EARNING' ? amountCents(component.amount, component.name) : 0),
    0,
  );
  const deductionsCents = components.reduce(
    (total, component) => total + (component.kind === 'DEDUCTION' ? amountCents(component.amount, component.name) : 0),
    0,
  );
  const money = (cents: number) => (cents / 100).toFixed(2);
  const statutoryNames: Record<typeof STATUTORY_CODES[number], string> = {
    PROVIDENT_FUND: 'Provident Fund (PF)',
    PROFESSIONAL_TAX: 'Professional Tax',
    ESI: 'Employee State Insurance (ESI)',
    TDS: 'Tax Deducted at Source (TDS)',
  };
  return {
    monthlyGross: money(grossCents),
    basicAmount: money(basicCents),
    components,
    allowancesTotal: money(allowancesCents),
    deductionsTotal: money(deductionsCents),
    estimatedNet: money(grossCents - deductionsCents),
    statutory: STATUTORY_CODES.map(code => ({
      code,
      name: statutoryNames[code],
      status: 'NOT_CONFIGURED' as const,
      note: 'No approved rule is configured, so this is not calculated.',
    })),
    basis: 'Monthly gross = basic + allowances. Basic is the balancing figure. Net is before attendance proration and salary-advance recovery.',
  };
}

/** Removes a legacy manual marker from component labels. */
export const displayComponentName = (name: string) => name.replace(/\s*\(manual\)\s*$/i, '').trim() || 'Component';

/** Only components the user filled in are sent to the preview; blanks are "not entered", never silently zero. */
export function breakdownRequestComponents(components: SalaryComponentInput[]) {
  return components
    .filter(item => item.amount.trim() !== '' && Number(item.amount) > 0)
    .map(item => ({ code: item.code?.trim().toUpperCase() || componentCode(item.name), name: item.name.trim(), kind: item.kind, amount: item.amount.trim() }));
}

export const formatInr = (value: string | number) => `₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
