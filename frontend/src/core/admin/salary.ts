
/**
 * BranchSuite Business - Monthly Salary Assignment
 *
 * Creates:
 * 1. Salary structure
 * 2. Optional deduction component
 * 3. Employee salary assignment
 *
 * Salary structure and assignment are two separate
 * backend operations, not one transaction.
 */

import { payrollApi } from './api';
import { getAdminScope } from './scope';

// =====================================================
// TYPES
// =====================================================

export type MonthlySalaryInput = {
  userId: string;
  branchId: string;
  employeeName: string;
  gross: number;
  deductions: number;
  effectiveFrom: string;
};

// =====================================================
// FIRST DAY OF MONTH
// =====================================================

export function firstOfMonth(
  isoDate: string
): string {
  return `${isoDate.slice(0, 7)}-01`;
}

// =====================================================
// FORMAT CURRENCY
// =====================================================

function formatAmount(
  amount: number
): string {
  return amount.toFixed(2);
}

// =====================================================
// VALIDATE SALARY INPUTS
// =====================================================

function validateSalary(
  input: MonthlySalaryInput
): void {
  if (!input.userId?.trim()) {
    throw new Error(
      'Employee user ID is required.'
    );
  }

  if (!input.branchId?.trim()) {
    throw new Error(
      'Employee branch ID is required.'
    );
  }

  if (!input.employeeName?.trim()) {
    throw new Error(
      'Employee name is required.'
    );
  }

  if (
    !Number.isFinite(input.gross) ||
    input.gross <= 0
  ) {
    throw new Error(
      'Monthly gross salary must be greater than zero.'
    );
  }

  if (
    !Number.isFinite(input.deductions) ||
    input.deductions < 0 ||
    input.deductions > input.gross
  ) {
    throw new Error(
      'Monthly deductions must be between zero and gross salary.'
    );
  }

  const validMoneyPrecision = (value: number) =>
    Math.abs(
      value * 100 - Math.round(value * 100)
    ) < 1e-6;

  if (
    !validMoneyPrecision(input.gross) ||
    !validMoneyPrecision(input.deductions)
  ) {
    throw new Error(
      'Salary amounts can have a maximum of two decimal places.'
    );
  }

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveFrom)
  ) {
    throw new Error(
      'Salary effective date must use YYYY-MM-DD.'
    );
  }

  const parsedDate = new Date(
    `${input.effectiveFrom}T00:00:00.000Z`
  );

  if (
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !==
      input.effectiveFrom
  ) {
    throw new Error(
      'Salary effective date is invalid.'
    );
  }

  if (!input.effectiveFrom.endsWith('-01')) {
    throw new Error(
      'Salary assignment must start on the first day of a month.'
    );
  }
}

// =====================================================
// ASSIGN MONTHLY SALARY
// =====================================================

export async function assignMonthlySalary(
  input: MonthlySalaryInput
) {
  // STEP 1: Validate before writing any records.

  validateSalary(input);

  // STEP 2: Resolve current company scope.

  const scope = await getAdminScope();

  // STEP 3: Check existing salary assignments.
  //
  // Prevent accidental duplicate initial setup.
  // Backend validation remains authoritative.

  const existingSalaries = await payrollApi.salaries(
    scope.companyId,
    input.branchId
  );

  const existingAssignment = existingSalaries.find(
    salary => salary.userId === input.userId
  );

  if (existingAssignment) {
    throw new Error(
      'This employee already has a salary assignment ' +
      'in the selected branch. Review the existing ' +
      'assignment in Payroll before creating another.'
    );
  }

  // STEP 4: Prepare salary structure.

  const employeeLabel = input.employeeName
    .trim()
    .slice(0, 50);

  const structureName =
    `${employeeLabel} · monthly · ` +
    Date.now().toString(36);

  const components:
    {
      code: string;
      name: string;
      kind: 'EARNING' | 'DEDUCTION';
      amount: string;
    }[] =
    input.deductions > 0
      ? [
          {
            code: 'DEDUCTIONS',
            name: 'Monthly deductions',
            kind: 'DEDUCTION',
            amount: formatAmount(
              input.deductions
            ),
          },
        ]
      : [];

  // STEP 5: Create salary structure.

  const structure = await payrollApi.createStructure({
    companyId: scope.companyId,
    name: structureName,
    basicAmount: formatAmount(input.gross),
    components,
  });

  // STEP 6: Create employee salary assignment.

  try {
    return await payrollApi.assignSalary({
      companyId: scope.companyId,
      branchId: input.branchId,
      userId: input.userId,
      structureId: structure.id,
      effectiveFrom: input.effectiveFrom,
    });
  } catch (error) {
    console.error(
      'Salary structure created but assignment failed:',
      error
    );

    throw new Error(
      'The salary structure was created, but the ' +
      'employee salary assignment failed. Check ' +
      'Payroll before retrying. An unused salary ' +
      'structure may require administrator review.'
    );
  }
}
