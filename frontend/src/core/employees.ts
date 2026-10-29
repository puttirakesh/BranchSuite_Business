import { getAvailableBranches } from "./admin/available-branches";

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
  reportingManagerId?: string;
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

    reportingManager: dto.reportingManager?.name ?? splitNotes(dto.notes).manager,
    reportingManagerId: dto.reportingManagerId ?? undefined,

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

  if (profile.phone.trim() && !/^\d{10}$/.test(profile.phone.trim())) {
    throw new Error(
      'Enter a 10-digit phone number.'
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
      !password.trim() ||
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
    gross <= 0
  ) {
    throw new Error(
      'Monthly gross salary must be greater than zero.'
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

  const created = await employeesApi.onboard({
    companyId: scope.companyId, branchId, joiningDate,
    name: profile.fullName.trim(), email: profile.email.trim().toLowerCase(),
    ...(profile.phone.trim() ? { phone: profile.phone.trim() } : {}),
    department: profile.department.trim(), designation: profile.jobTitle.trim(),
    reportingManagerId: profile.reportingManagerId,
    loginEnabled: access?.loginEnabled !== false,
    password: access?.loginEnabled !== false ? access?.temporaryPassword : undefined,
    status: access?.status === 'inactive' ? 'INACTIVE' : 'ACTIVE',
    gross: String(access?.monthlyGrossSalary ?? 0), deductions: String(access?.monthlyDeductions ?? 0),
    bankEnding: access?.bankEnding || undefined,
  });
  return mapEmployee(created);
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
