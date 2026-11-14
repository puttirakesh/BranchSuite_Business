export type SalaryComponentKind = 'EARNING' | 'DEDUCTION';

export type SalaryComponentInput = {
  code?: string;
  name: string;
  kind: SalaryComponentKind;
  amount: string;
};

export type SalaryStructureInput = {
  basicAmount: string;
  gross: number;
  deductions: number;
  components: {
    code: string;
    name: string;
    kind: SalaryComponentKind;
    amount: string;
  }[];
};

export const initialSalaryComponents = (): SalaryComponentInput[] => [
  { code: 'HRA', name: 'House Rent Allowance', kind: 'EARNING', amount: '' },
  { code: 'SPECIAL_ALLOWANCE', name: 'Special Allowance', kind: 'EARNING', amount: '' },
  { code: 'CONVEYANCE_ALLOWANCE', name: 'Conveyance Allowance', kind: 'EARNING', amount: '' },
  { code: 'PROVIDENT_FUND', name: 'Provident Fund (PF)', kind: 'DEDUCTION', amount: '' },
  { code: 'ESI', name: 'Employee State Insurance (ESI)', kind: 'DEDUCTION', amount: '' },
  { code: 'PROFESSIONAL_TAX', name: 'Professional Tax', kind: 'DEDUCTION', amount: '' },
  { code: 'TDS', name: 'TDS', kind: 'DEDUCTION', amount: '' },
];

const moneyPattern = /^\d{1,12}(\.\d{1,2})?$/;

function amountFromPaise(paise: number): string {
  return (paise / 100).toFixed(2);
}

/**
 * Editable onboarding estimates, not statutory payroll advice. Local PF/ESI eligibility,
 * wage ceilings, professional tax and income-tax rules must be confirmed by the employer.
 */
export function suggestedIndianSalaryComponents(grossAmount: string, basicAmount?: string): Record<string, string> | null {
  const grossText = grossAmount.trim();
  if (!moneyPattern.test(grossText)) return null;
  const grossPaise = Math.round(Number(grossText) * 100);
  if (!Number.isSafeInteger(grossPaise) || grossPaise <= 0) return null;

  const providedBasic = basicAmount?.trim();
  const basicPaise = providedBasic && moneyPattern.test(providedBasic)
    ? Math.round(Number(providedBasic) * 100)
    : Math.round(grossPaise / 2);
  const defaultBasicPaise = Math.round(grossPaise / 2);
  const hraPaise = Math.round(defaultBasicPaise * 40 / 100);
  return {
    HRA: amountFromPaise(hraPaise),
    SPECIAL_ALLOWANCE: amountFromPaise(grossPaise - defaultBasicPaise - hraPaise),
    PROVIDENT_FUND: amountFromPaise(Math.round(basicPaise * 12 / 100)),
    ESI: grossPaise <= 2_100_000 ? amountFromPaise(Math.round(grossPaise * 75 / 10_000)) : '',
  };
}

function cents(value: string, label: string, required = false): number {
  const text = value.trim();
  if (!text && !required) return 0;
  if (!moneyPattern.test(text)) {
    throw new Error(`${label} must be a non-negative amount with up to two decimal places.`);
  }
  return Math.round(Number(text) * 100);
}

export function componentCode(name: string): string {
  return name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30);
}

export function parseSalaryStructure(
  basicAmount: string,
  inputComponents: SalaryComponentInput[],
): SalaryStructureInput {
  const basic = cents(basicAmount, 'Basic salary', true);
  if (basic <= 0) throw new Error('Basic salary must be greater than zero.');

  if (inputComponents.length > 40) {
    throw new Error('A salary structure can contain at most 40 components.');
  }

  const codes = new Set(['BASIC']);
  const components: SalaryStructureInput['components'] = [];
  let earnings = basic;
  let deductions = 0;

  for (const [index, component] of inputComponents.entries()) {
    const name = component.name.trim();
    const amount = cents(component.amount, name || 'Component amount');
    if (amount === 0) continue;
    if (!name) throw new Error('Give every non-zero salary component a name.');
    if (name.length > 100) throw new Error('Salary component names must be 100 characters or fewer.');

    const code = component.code?.trim().toUpperCase() || componentCode(name) || `COMPONENT_${index + 1}`;
    if (!/^[A-Z0-9_]{1,30}$/.test(code) || codes.has(code) || ['INCENTIVE', 'ADVANCE_RECOVERY'].includes(code)) {
      throw new Error(`“${name}” duplicates or uses a reserved payroll component code.`);
    }
    codes.add(code);
    components.push({
      code,
      name,
      kind: component.kind,
      amount: (amount / 100).toFixed(2),
    });
    if (component.kind === 'EARNING') earnings += amount;
    else deductions += amount;
  }

  if (deductions > earnings) throw new Error('Deductions cannot exceed gross earnings.');
  return {
    basicAmount: (basic / 100).toFixed(2),
    gross: earnings / 100,
    deductions: deductions / 100,
    components,
  };
}

export function salaryStructureTotals(
  basicAmount: string,
  components: SalaryComponentInput[],
): { gross: number; deductions: number } {
  const basic = Number(basicAmount);
  let gross = Number.isFinite(basic) ? basic : 0;
  let deductions = 0;
  for (const component of components) {
    const amount = Number(component.amount);
    if (!Number.isFinite(amount) || amount < 0) continue;
    if (component.kind === 'EARNING') gross += amount;
    else deductions += amount;
  }
  return { gross, deductions };
}
