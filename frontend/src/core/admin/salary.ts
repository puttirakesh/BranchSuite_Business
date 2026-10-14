import { payrollApi } from './api';
import { getAdminScope } from './scope';

/**
 * Gives an employee a fixed monthly salary in the backend payroll module:
 * a dedicated salary structure (basic = gross, one DEDUCTION component) assigned from `effectiveFrom`.
 *
 * Backend constraints (unchanged):
 * - there is no endpoint to end or revise an assignment, so this is a one-time setup per employee;
 * - payroll calculation rejects assignments that start mid-month, so callers pass the 1st of a month.
 */
export async function assignMonthlySalary(input: {
  userId: string; branchId: string; employeeName: string;
  gross: number; deductions: number; effectiveFrom: string;
}) {
  const scope = await getAdminScope();
  const amount = (value: number) => Math.max(0, value).toFixed(2);
  const label = input.employeeName.trim().slice(0, 50) || 'Employee';
  const structure = await payrollApi.createStructure({
    companyId: scope.companyId,
    // Structure names are unique per company.
    name: `${label} · monthly · ${Date.now().toString(36)}`,
    basicAmount: amount(input.gross),
    components: input.deductions > 0
      ? [{ code: 'DEDUCTIONS', name: 'Monthly deductions', kind: 'DEDUCTION', amount: amount(input.deductions) }]
      : [],
  });
  return payrollApi.assignSalary({
    companyId: scope.companyId,
    branchId: input.branchId,
    userId: input.userId,
    structureId: structure.id,
    effectiveFrom: input.effectiveFrom,
  });
}

export const firstOfMonth = (isoDate: string) => `${isoDate.slice(0, 7)}-01`;
