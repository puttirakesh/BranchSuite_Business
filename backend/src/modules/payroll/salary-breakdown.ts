import { BadRequestException } from '@nestjs/common';
import { Prisma, SalaryComponentKind } from '@prisma/client';

const Decimal = Prisma.Decimal;
type Money = Prisma.Decimal;

export type BreakdownComponent = { code: string; name: string; kind: SalaryComponentKind; amount: Money };

/**
 * Statutory deductions the product knows about but has NO configured rule for (no rates, wage ceilings,
 * jurisdictions or eligibility exist in the schema, settings or docs). They are reported as NOT_CONFIGURED
 * and never counted as a confirmed zero liability. Any amount for them must be entered as a regular
 * deduction component by an authorised user until a rules source is approved.
 */
export const STATUTORY_DEDUCTIONS = [
  { code: 'PROVIDENT_FUND', name: 'Provident Fund (PF)' },
  { code: 'PROFESSIONAL_TAX', name: 'Professional Tax' },
  { code: 'ESI', name: 'Employee State Insurance (ESI)' },
  { code: 'TDS', name: 'Tax Deducted at Source (TDS)' },
] as const;

const RESERVED = ['BASIC', 'INCENTIVE', 'ADVANCE_RECOVERY'];
export const MAX_SALARY_COMPONENTS = 40;

/** Normalises and validates component codes; BASIC is derived and may not be supplied. */
export function normalizeComponents(components: { code: string; name: string; kind: SalaryComponentKind; amount: string | Money }[]): BreakdownComponent[] {
  if (components.length > MAX_SALARY_COMPONENTS) throw new BadRequestException('Too many salary components.');
  const seen = new Set<string>();
  return components.map(component => {
    const code = component.code?.trim().toUpperCase();
    const name = component.name?.trim();
    if (!code || !/^[A-Z0-9_]{1,30}$/.test(code) || !name || RESERVED.includes(code) || seen.has(code)) {
      throw new BadRequestException('Salary component codes and names must be unique and valid.');
    }
    if (component.kind !== SalaryComponentKind.EARNING && component.kind !== SalaryComponentKind.DEDUCTION) throw new BadRequestException('Invalid salary component kind.');
    seen.add(code);
    return { code, name, kind: component.kind, amount: new Decimal(component.amount) };
  });
}

/**
 * Single source of truth for the salary semantics used everywhere (onboarding, revisions, payroll):
 *   Monthly gross = Basic + sum(EARNING components)      (allowances are part of gross)
 *   Deductions    = sum(DEDUCTION components)            (employee deductions are NOT part of gross)
 *   Estimated net = Gross - Deductions                   (before proration and salary-advance recovery)
 */
export function itemizedTotals(basicAmount: Money, components: BreakdownComponent[]): { gross: Money; deductions: Money } {
  let gross = basicAmount;
  let deductions = new Decimal(0);
  for (const component of components) {
    if (component.kind === SalaryComponentKind.EARNING) gross = gross.add(component.amount);
    else deductions = deductions.add(component.amount);
  }
  return { gross, deductions };
}

/** Shared by employee onboarding and salary revisions: the itemised parts must reproduce the declared totals. */
export function assertItemizedSalaryMatches(input: { gross: Money; deductions: Money; basicAmount: Money; components: BreakdownComponent[] }): void {
  if (!input.basicAmount.greaterThan(0)) throw new BadRequestException('A positive basic amount and salary components are required together.');
  const totals = itemizedTotals(input.basicAmount, input.components);
  if (!totals.gross.equals(input.gross) || !totals.deductions.equals(input.deductions)) {
    throw new BadRequestException('Gross and deductions must match the itemized salary components.');
  }
}

export type SalaryBreakdown = {
  monthlyGross: string;
  basicAmount: string;
  components: { code: string; name: string; kind: SalaryComponentKind; amount: string }[];
  allowancesTotal: string;
  deductionsTotal: string;
  estimatedNet: string;
  statutory: { code: string; name: string; status: 'NOT_CONFIGURED'; note: string }[];
  basis: string;
};

/**
 * Builds a consistent breakdown from a Monthly Gross Salary. No split percentages are invented: Basic is
 * the balancing figure, i.e. gross minus the explicitly supplied allowances (so with none supplied Basic
 * equals gross, which is the system's existing legacy behaviour). Deductions are only those supplied.
 */
export function computeSalaryBreakdown(input: { monthlyGross: string; components?: { code: string; name: string; kind: SalaryComponentKind; amount: string }[] }): SalaryBreakdown {
  const gross = new Decimal(input.monthlyGross);
  if (!gross.greaterThan(0)) throw new BadRequestException('Monthly gross salary must be greater than zero.');
  const components = normalizeComponents(input.components ?? []).filter(component => component.amount.greaterThan(0));
  const allowances = components.filter(component => component.kind === SalaryComponentKind.EARNING).reduce((sum, component) => sum.add(component.amount), new Decimal(0));
  const deductions = components.filter(component => component.kind === SalaryComponentKind.DEDUCTION).reduce((sum, component) => sum.add(component.amount), new Decimal(0));
  const basic = gross.sub(allowances);
  if (!basic.greaterThan(0)) throw new BadRequestException('Allowances must be less than the monthly gross salary so a positive basic salary remains.');
  if (deductions.greaterThan(gross)) throw new BadRequestException('Deductions cannot exceed the monthly gross salary.');
  const fixed = (value: Money) => value.toFixed(2);
  return {
    monthlyGross: fixed(gross),
    basicAmount: fixed(basic),
    components: components.map(component => ({ code: component.code, name: component.name, kind: component.kind, amount: fixed(component.amount) })),
    allowancesTotal: fixed(allowances),
    deductionsTotal: fixed(deductions),
    estimatedNet: fixed(gross.sub(deductions)),
    statutory: STATUTORY_DEDUCTIONS.map(item => ({ ...item, status: 'NOT_CONFIGURED' as const, note: 'No approved rule is configured, so this is not calculated.' })),
    basis: 'Monthly gross = basic + allowances. Basic is the balancing figure. Net is before attendance proration and salary-advance recovery.',
  };
}
