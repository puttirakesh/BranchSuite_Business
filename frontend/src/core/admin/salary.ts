
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
import { parseSalaryStructure, type SalaryComponentInput } from '../payroll-structure';

// =====================================================
// TYPES
// =====================================================

export type MonthlySalaryInput = {
  userId: string;
  branchId: string;
  employeeName: string;
  basicAmount: string;
  components: SalaryComponentInput[];
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
// VALIDATE SALARY INPUTS
// =====================================================

function validateSalary(
  input: MonthlySalaryInput
): ReturnType<typeof parseSalaryStructure> {
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

  const structure = parseSalaryStructure(input.basicAmount, input.components);

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
  return structure;
}

// =====================================================
// ASSIGN MONTHLY SALARY
// =====================================================

export async function assignMonthlySalary(
  input: MonthlySalaryInput
) {
  // STEP 1: Validate before writing any records.

  const salary = validateSalary(input);

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

  // STEP 5: Create salary structure.

  const structure = await payrollApi.createStructure({
    companyId: scope.companyId,
    name: structureName,
    basicAmount: salary.basicAmount,
    components: salary.components,
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
