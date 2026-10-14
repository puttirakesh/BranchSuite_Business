/**
 * Employee records for the admin pages, backed by the API:
 *   - login account  → /users         (name, email, phone, ACTIVE/INACTIVE = login enabled)
 *   - employee record → /employees    (code, branch, department, designation, joining date, status)
 *   - monthly salary  → /payroll      (structure + assignment, see core/admin/salary.ts)
 *
 * The exported names and shapes are unchanged so existing pages keep working.
 * `Employee.id` is the backend **user id** — the same id attendance, leave, payroll and CRM use.
 */
import { employeesApi, usersApi, type EmployeeProfileDto } from './admin/api';
import { getAdminScope, getCompanyBranches, resolveBranchId } from './admin/scope';
import { fromDisplayDate, toDisplayDate } from './admin/local';
import { assignMonthlySalary, firstOfMonth } from './admin/salary';

export type EmployeeProfile = {
  fullName: string;
  email: string;
  phone: string;
  jobTitle: string;
  department: string;
  branch: string;
  reportingManager: string;
  joiningDate: string;
  /** Preferred over `branch` (name) when the UI knows the backend branch id. */
  branchId?: string;
};

export type EmployeeAccess = {
  monthlyGrossSalary: number;
  monthlyDeductions: number;
  bankEnding: string;
  status: 'active' | 'inactive';
  loginEnabled: boolean;
  assignedCrmTasks: boolean;
  /** Initial password for the employee's login account. */
  temporaryPassword?: string;
};

export type Employee = EmployeeProfile & Partial<EmployeeAccess> & {
  id: string;
  createdAt: string;
  status?: 'active' | 'inactive';
  loginEnabled?: boolean;
  /** Backend EmployeeProfile id (used for status changes). */
  profileId?: string;
  employeeCode?: string;
  employmentStatus?: EmployeeProfileDto['status'];
};

const MANAGER_PREFIX = 'Reporting manager: ';

function splitNotes(notes: string | null): { manager: string; rest: string } {
  const lines = (notes ?? '').split('\n');
  const managerLine = lines.find(line => line.startsWith(MANAGER_PREFIX));
  return {
    manager: managerLine ? managerLine.slice(MANAGER_PREFIX.length).trim() : '',
    rest: lines.filter(line => line !== managerLine).join('\n').trim(),
  };
}

export function mapEmployee(dto: EmployeeProfileDto): Employee {
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
    status: dto.status === 'ACTIVE' ? 'active' : 'inactive',
    employmentStatus: dto.status,
    loginEnabled: dto.user.status === 'ACTIVE',
  };
}

export async function getEmployees(): Promise<Employee[]> {
  const scope = await getAdminScope();
  const profiles = await employeesApi.list(scope.companyId);
  return profiles.map(mapEmployee);
}

function generatedPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let value = '';
  for (let index = 0; index < 20; index += 1) value += alphabet[Math.floor(Math.random() * alphabet.length)];
  return value;
}

function employeeCodeFor(name: string): string {
  const initials = name.trim().split(/\s+/).map(part => part[0] ?? '').join('').replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase() || 'EMP';
  return `${initials}-${Date.now().toString(36).toUpperCase()}`;
}

/**
 * Creates the login account (or reuses an existing one in this business with the same email
 * that has no employee record yet, so a failed attempt can be retried), the employee record,
 * and — when a salary is entered — the payroll salary assignment.
 */
export async function addEmployee(profile: EmployeeProfile, access?: EmployeeAccess): Promise<Employee> {
  const scope = await getAdminScope();
  const branches = (await getCompanyBranches()).filter(branch => branch.status === 'ACTIVE');
  const branchId = profile.branchId && branches.some(branch => branch.id === profile.branchId)
    ? profile.branchId
    : resolveBranchId(branches, profile.branch);
  if (!branchId) throw new Error('Choose one of your branches for this employee.');

  const joiningDate = fromDisplayDate(profile.joiningDate);
  if (!joiningDate) throw new Error('Enter a valid joining date.');

  const email = profile.email.trim().toLowerCase();
  const fullName = profile.fullName.trim();
  const loginEnabled = access?.loginEnabled !== false;

  // Reuse a matching account that was created by an earlier, interrupted attempt.
  const [users, existingProfiles] = await Promise.all([usersApi.list(), employeesApi.list(scope.companyId)]);
  const existingUser = users.find(user => user.email.toLowerCase() === email);
  if (existingUser && existingProfiles.some(item => item.userId === existingUser.id)) {
    throw new Error('An employee with this work email already exists.');
  }
  const user = existingUser ?? await usersApi.create({
    name: fullName,
    email,
    password: loginEnabled && access?.temporaryPassword ? access.temporaryPassword : generatedPassword(),
    ...(profile.phone.trim() ? { phone: profile.phone.trim() } : {}),
  });

  const notes = profile.reportingManager.trim() ? `${MANAGER_PREFIX}${profile.reportingManager.trim()}` : undefined;
  let created = await employeesApi.create({
    companyId: scope.companyId,
    branchId,
    userId: user.id,
    employeeCode: employeeCodeFor(fullName),
    joiningDate,
    workEmail: email,
    ...(profile.department.trim() ? { department: profile.department.trim() } : {}),
    ...(profile.jobTitle.trim() ? { designation: profile.jobTitle.trim() } : {}),
    ...(notes ? { notes } : {}),
  });

  // Salary first: the payroll module only accepts active login accounts.
  const gross = access?.monthlyGrossSalary ?? 0;
  if (gross > 0) {
    try {
      await assignMonthlySalary({
        userId: user.id, branchId, employeeName: fullName, gross,
        deductions: access?.monthlyDeductions ?? 0,
        // Mid-month assignments block payroll for the whole branch, so start on the 1st.
        effectiveFrom: firstOfMonth(joiningDate),
      });
    } catch (error) {
      // The employee exists; the salary can still be set from Payroll inputs.
      console.warn('Employee created, but salary assignment failed:', error);
    }
  }
  if (access?.status === 'inactive') created = await employeesApi.setStatus(created.id, 'INACTIVE');
  if (!loginEnabled) await usersApi.deactivate(user.id);

  return mapEmployee({ ...created, user: { ...created.user, status: loginEnabled ? 'ACTIVE' : 'INACTIVE' } });
}

async function findEmployee(id: string): Promise<Employee> {
  const employee = (await getEmployees()).find(item => item.id === id);
  if (!employee?.profileId) throw new Error('Employee could not be found.');
  return employee;
}

export async function setEmployeeStatus(id: string, status: 'active' | 'inactive'): Promise<Employee> {
  const employee = await findEmployee(id);
  if (employee.employmentStatus === 'EXITED' && status === 'active') {
    throw new Error('This employee has exited. Rehiring is not supported yet.');
  }
  return mapEmployee(await employeesApi.setStatus(employee.profileId!, status === 'active' ? 'ACTIVE' : 'INACTIVE'));
}

/**
 * Login on/off maps to the user account status. Note: the backend also skips
 * inactive accounts when marking attendance and calculating payroll.
 */
export async function setEmployeeLoginEnabled(id: string, loginEnabled: boolean): Promise<Employee> {
  const employee = await findEmployee(id);
  if (loginEnabled) await usersApi.activate(id); else await usersApi.deactivate(id);
  return mapEmployee(await employeesApi.get(employee.profileId!));
}

