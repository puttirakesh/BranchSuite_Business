import { getAvailableBranches } from "./admin/available-branches";

import * as Crypto from 'expo-crypto';

import {
  employeesApi,
  usersApi,
  type EmployeeProfileDto,
} from './admin/api';

import {
  getAdminScope,
  resolveBranchId,
} from './admin/scope';

import {
  fromDisplayDate,
  toDisplayDate,
} from './admin/local';

import {
  assignMonthlySalary,
  firstOfMonth,
} from './admin/salary';

// =====================================================
// TYPES
// =====================================================

export type EmployeeProfile = {
  fullName: string;
  email: string;
  phone: string;
  jobTitle: string;
  department: string;
  branch: string;
  reportingManager: string;
  joiningDate: string;
  branchId?: string;
};

export type EmployeeAccess = {
  monthlyGrossSalary: number;
  monthlyDeductions: number;
  bankEnding: string;
  status: 'active' | 'inactive';
  loginEnabled: boolean;
  assignedCrmTasks: boolean;
  temporaryPassword?: string;
};

export type Employee = EmployeeProfile &
  Partial<EmployeeAccess> & {
    id: string;
    createdAt: string;
    status?: 'active' | 'inactive';
    loginEnabled?: boolean;
    profileId?: string;
    employeeCode?: string;
    employmentStatus?: EmployeeProfileDto['status'];
  };

// =====================================================
// CONSTANTS
// =====================================================

const MANAGER_PREFIX = 'Reporting manager: ';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// =====================================================
// NOTES
// =====================================================

function splitNotes(
  notes: string | null
): {
  manager: string;
  rest: string;
} {
  const lines = (notes ?? '').split('\n');

  const managerLine = lines.find(
    line => line.startsWith(MANAGER_PREFIX)
  );

  return {
    manager: managerLine
      ? managerLine.slice(MANAGER_PREFIX.length).trim()
      : '',
    rest: lines
      .filter(line => line !== managerLine)
      .join('\n')
      .trim(),
  };
}

// =====================================================
// MAP BACKEND EMPLOYEE
// =====================================================

export function mapEmployee(
  dto: EmployeeProfileDto
): Employee {
  return {
    id: dto.userId,
    profileId: dto.id,
    employeeCode: dto.employeeCode,

    fullName: dto.user.name,
    email: dto.workEmail ?? dto.user.email,
    phone: dto.user.phone ?? '',

    jobTitle: dto.designation ?? '',
    department: dto.department ?? '',

    branch: dto.branch.name,
    branchId: dto.branchId,

    reportingManager: splitNotes(dto.notes).manager,

    joiningDate: toDisplayDate(dto.joiningDate),
    createdAt: dto.createdAt,

    status:
      dto.status === 'ACTIVE'
        ? 'active'
        : 'inactive',

    employmentStatus: dto.status,

    loginEnabled: dto.user.status === 'ACTIVE',
  };
}

// =====================================================
// LIST EMPLOYEES
// =====================================================

export async function getEmployees(): Promise<Employee[]> {
  const scope = await getAdminScope();

  const profiles = await employeesApi.list(
    scope.companyId
  );

  return profiles.map(mapEmployee);
}

// =====================================================
// GENERATE SECURE PASSWORD
// =====================================================

async function generatedPassword(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(24);

  return Array.from(bytes)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

// =====================================================
// GENERATE EMPLOYEE CODE
// =====================================================

function employeeCodeFor(name: string): string {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .map(part => part[0] ?? '')
      .join('')
      .replace(/[^A-Za-z0-9]/g, '')
      .slice(0, 3)
      .toUpperCase() || 'EMP';

  return (
    `${initials}-` +
    Date.now().toString(36).toUpperCase()
  );
}

// =====================================================
// VALIDATE EMPLOYEE DETAILS
// =====================================================

function validateEmployeeInput(
  profile: EmployeeProfile,
  access?: EmployeeAccess
): void {
  const name = profile.fullName.trim();

  if (!name || name.length > 150) {
    throw new Error(
      'Employee name must contain 1 to 150 characters.'
    );
  }

  const email = profile.email.trim().toLowerCase();

  if (
    !EMAIL_REGEX.test(email) ||
    email.length > 254
  ) {
    throw new Error(
      'Enter a valid employee email address.'
    );
  }

  if (profile.phone.trim().length > 30) {
    throw new Error(
      'Phone number cannot exceed 30 characters.'
    );
  }

  if (!profile.reportingManager.trim()) {
    throw new Error(
      'Reporting manager is required.'
    );
  }

  const loginEnabled = access?.loginEnabled !== false;

  if (loginEnabled) {
    const password = access?.temporaryPassword ?? '';

    if (
      password.length < 8 ||
      password.length > 128
    ) {
      throw new Error(
        'Temporary password must contain 8 to 128 characters.'
      );
    }
  }

  if (!access) return;

  const gross = access.monthlyGrossSalary;
  const deductions = access.monthlyDeductions;

  if (
    !Number.isFinite(gross) ||
    gross < 0
  ) {
    throw new Error(
      'Enter a valid monthly gross salary.'
    );
  }

  if (
    !Number.isFinite(deductions) ||
    deductions < 0 ||
    deductions > gross
  ) {
    throw new Error(
      'Monthly deductions must be between zero and gross salary.'
    );
  }

  const validPrecision = (value: number) =>
    Math.abs(value * 100 - Math.round(value * 100)) <
    1e-6;

  if (
    !validPrecision(gross) ||
    !validPrecision(deductions)
  ) {
    throw new Error(
      'Salary amounts can have at most two decimal places.'
    );
  }

  if (
    access.bankEnding &&
    !/^\d{4}$/.test(access.bankEnding)
  ) {
    throw new Error(
      'Bank ending must contain exactly four digits.'
    );
  }
}

// =====================================================
// CREATE EMPLOYEE
// =====================================================

export async function addEmployee(
  profile: EmployeeProfile,
  access?: EmployeeAccess
): Promise<Employee> {
  // STEP 1: Validate all inputs.

  validateEmployeeInput(profile, access);

  // STEP 2: Resolve company and branch.

  const scope = await getAdminScope();

  const branches = await getAvailableBranches();

  const branchId =
    profile.branchId &&
    branches.some(branch => branch.id === profile.branchId)
      ? profile.branchId
      : resolveBranchId(branches, profile.branch);

  if (!branchId) {
    throw new Error(
      'Choose an active company branch for this employee.'
    );
  }

  const joiningDate = fromDisplayDate(
    profile.joiningDate
  );

  if (!joiningDate) {
    throw new Error(
      'Enter a valid joining date.'
    );
  }

  const fullName = profile.fullName.trim();
  const email = profile.email.trim().toLowerCase();
  const loginEnabled = access?.loginEnabled !== false;

  // STEP 3: Verify employee does not already exist.
  //
  // Do not automatically reuse a user account.
  // A previous failed request may have partially
  // created an account, which requires review.

  const [users, existingProfiles] = await Promise.all([
    usersApi.list(),
    employeesApi.list(scope.companyId),
  ]);

  const existingUser = users.find(
    user => user.email.toLowerCase() === email
  );

  const existingProfile = existingProfiles.find(
    item =>
      item.user.email.toLowerCase() === email ||
      item.workEmail?.toLowerCase() === email
  );

  if (existingProfile) {
    throw new Error(
      'An employee with this email already exists.'
    );
  }

  if (existingUser) {
    throw new Error(
      'A user account with this email already exists. ' +
      'Check Users and Employees before proceeding. ' +
      'An earlier onboarding attempt may have partially completed.'
    );
  }

  // STEP 4: Prepare initial password.
  //
  // When login is disabled, create an unpredictable
  // password that is not shared with anyone.
  //
  // The existing backend requires a password
  // even for accounts that will be deactivated.

  const initialPassword = loginEnabled
    ? access!.temporaryPassword!
    : await generatedPassword();

  // STEP 5: Create user account.

  const user = await usersApi.create({
    name: fullName,
    email,
    password: initialPassword,
    ...(profile.phone.trim()
      ? { phone: profile.phone.trim() }
      : {}),
  });

  // STEP 6: Create employee profile.
  //
  // The backend also creates company and branch
  // access in the employee-profile transaction.

  const notes = profile.reportingManager.trim()
    ? `${MANAGER_PREFIX}${profile.reportingManager.trim()}`
    : undefined;

  let created: EmployeeProfileDto;

  try {
    created = await employeesApi.create({
      companyId: scope.companyId,
      branchId,
      userId: user.id,
      employeeCode: employeeCodeFor(fullName),
      joiningDate,
      workEmail: email,

      ...(profile.department.trim()
        ? { department: profile.department.trim() }
        : {}),

      ...(profile.jobTitle.trim()
        ? { designation: profile.jobTitle.trim() }
        : {}),

      ...(notes ? { notes } : {}),
    });
  } catch (error) {
    console.error(
      'Employee profile creation failed:',
      error
    );

    throw new Error(
      'The user account may have been created, ' +
      'but employee profile creation failed. ' +
      'Check Users and Employees before retrying.'
    );
  }

  // STEP 7: Apply requested employment status.
  //
  // Perform this before salary creation so status
  // failures are detected earlier.

  if (access?.status === 'inactive') {
    try {
      created = await employeesApi.setStatus(
        created.id,
        'INACTIVE'
      );
    } catch (error) {
      console.error(
        'Employee employment status update failed:',
        error
      );

      throw new Error(
        'Employee profile was created, but employment ' +
        'status could not be updated. Check the employee ' +
        'record before attempting another creation.'
      );
    }
  }

  // STEP 8: Assign monthly salary.
  //
  // Salary assignment is attempted while the user
  // account is still ACTIVE because the existing
  // payroll backend requires an active user.

  const gross = access?.monthlyGrossSalary ?? 0;
  const deductions = access?.monthlyDeductions ?? 0;

  let salaryError: unknown = null;

  if (gross > 0) {
    try {
      await assignMonthlySalary({
        userId: user.id,
        branchId,
        employeeName: fullName,
        gross,
        deductions,
        effectiveFrom: firstOfMonth(joiningDate),
      });
    } catch (error) {
      salaryError = error;

      console.error(
        'Employee salary setup failed:',
        error
      );
    }
  }

  // STEP 9: Disable login if requested.
  //
  // This step must still run if salary fails.
  // Otherwise a failed salary request could leave
  // an account active against the admin's choice.

  if (!loginEnabled) {
    try {
      await usersApi.deactivate(user.id);
    } catch (error) {
      console.error(
        'Employee login deactivation failed:',
        error
      );

      throw new Error(
        'Employee profile was created, but login ' +
        'deactivation failed. Deactivate this account ' +
        'from Users immediately and verify its status.'
      );
    }
  }

  // STEP 10: Report partial salary failure.
  //
  // Do not return success if salary was requested
  // but could not be configured.

  if (salaryError) {
    throw new Error(
      'Employee account and profile were created, ' +
      'but salary setup failed. Do not add this employee ' +
      'again. Open Payroll to check and complete the ' +
      'salary assignment.'
    );
  }

  // STEP 11: Return employee.

  return mapEmployee({
    ...created,
    user: {
      ...created.user,
      status: loginEnabled ? 'ACTIVE' : 'INACTIVE',
    },
  });
}

// =====================================================
// FIND EMPLOYEE
// =====================================================

async function findEmployee(
  id: string
): Promise<Employee> {
  const employees = await getEmployees();

  const employee = employees.find(
    item => item.id === id
  );

  if (!employee?.profileId) {
    throw new Error(
      'Employee could not be found.'
    );
  }

  return employee;
}

// =====================================================
// CHANGE EMPLOYMENT STATUS
// =====================================================

export async function setEmployeeStatus(
  id: string,
  status: 'active' | 'inactive'
): Promise<Employee> {
  const employee = await findEmployee(id);

  if (
    employee.employmentStatus === 'EXITED' &&
    status === 'active'
  ) {
    throw new Error(
      'This employee has exited. Rehiring is not supported yet.'
    );
  }

  const updated = await employeesApi.setStatus(
    employee.profileId!,
    status === 'active' ? 'ACTIVE' : 'INACTIVE'
  );

  return mapEmployee(updated);
}

// =====================================================
// ENABLE / DISABLE EMPLOYEE LOGIN
// =====================================================

export async function setEmployeeLoginEnabled(
  id: string,
  loginEnabled: boolean
): Promise<Employee> {
  const employee = await findEmployee(id);

  if (loginEnabled) {
    await usersApi.activate(id);
  } else {
    await usersApi.deactivate(id);
  }

  const updated = await employeesApi.get(
    employee.profileId!
  );

  return mapEmployee(updated);
}
