/**
 * Company structure for the admin pages:
 *  - branches page      ⇄ /branches (name, active/inactive); code, location and manager kept on device
 *  - roles & access     ⇄ /users (name, email, active) + /users/:id/access (branch access)
 *  - workspace settings ⇄ /companies (company name, add company); accent colour kept on device
 */
import { branchesApi, companiesApi, employeesApi, usersApi, workspacePreferencesApi, type UserDto } from "./api";
import {
  getAdminScope,
  getCompanyBranches,
  invalidateAdminScope,
} from "./scope";
import { extrasKeys, readExtras, writeExtras } from "./local";

// ---------------------------------------------------------------- branches
// Branch metadata is server-backed, not local-device extras.
export type AdminBranch = {
  id: string;
  name: string;
  code: string;
  location: string;
  manager: string;
  employees: number;
  active: boolean;
};

export async function readBranches(): Promise<AdminBranch[]> {
  const branches = await getCompanyBranches();
  return branches.map((branch) => ({
    id: branch.id,
    name: branch.name,
    code: branch.code,
    location: branch.location,
    manager: branch.manager,
    employees: branch.employees,
    active: branch.status === "ACTIVE",
  }));
}

export async function saveBranches(next: AdminBranch[]): Promise<void> {
  const scope = await getAdminScope();
  const before = new Map(
    (await getCompanyBranches()).map((branch) => [branch.id, branch]),
  );
  for (const branch of next) {
    const current = before.get(branch.id);
    let id = branch.id;
    if (!current) {
      const created = await branchesApi.create(
        scope.companyId,
        branch.name.trim(),
        {
          code: branch.code.trim(),
          location: branch.location.trim(),
          manager: branch.manager.trim(),
        },
      );
      id = created.id;
    } else {
      const changes: {
        name?: string;
        code?: string;
        location?: string;
        manager?: string;
      } = {};
      if (current.name !== branch.name.trim())
        changes.name = branch.name.trim();
      if (current.code !== branch.code.trim())
        changes.code = branch.code.trim();
      if (current.location !== branch.location.trim())
        changes.location = branch.location.trim();
      if (current.manager !== branch.manager.trim())
        changes.manager = branch.manager.trim();
      if (Object.keys(changes).length) await branchesApi.update(id, changes);
    }
    if (
      !current
        ? !branch.active
        : (current.status === "ACTIVE") !== branch.active
    ) {
      await branchesApi.setStatus(id, branch.active ? "ACTIVE" : "INACTIVE");
    }
  }
  invalidateAdminScope();
}

// ---------------------------------------------------------------- users, roles & branch access
export type AccessRole =
  | "Business Owner"
  | "Business Admin"
  | "Company Manager"
  | "Branch Manager"
  | "Sales Manager"
  | "HR Manager"
  | "Payroll Officer"
  | "Employee";
export type AccessUser = {
  id: string;
  name: string;
  email: string;
  role: AccessRole;
  branches: string[];
  active: boolean;
  hasEmployeeProfile?: boolean;
};

const roleFromApi = (user: UserDto): AccessRole => {
  const names = user.roles.map((item) => item.role.name);
  if (names.includes("BUSINESS_OWNER")) return "Business Owner";
  if (names.includes("BUSINESS_ADMIN"))
    return "Business Admin";
  if (names.includes("COMPANY_MANAGER")) return "Company Manager";
  if (names.includes("BRANCH_MANAGER")) return "Branch Manager";
  if (names.includes("SALES_MANAGER")) return "Sales Manager";
  if (names.includes("HR_MANAGER")) return "HR Manager";
  if (names.includes("PAYROLL_MANAGER")) return "Payroll Officer";
  return "Employee";
};

let usersSnapshot: Map<string, AccessUser> | null = null;

export async function readAccessUsers(): Promise<AccessUser[]> {
  const scope = await getAdminScope();
  const [users, branches, employees] = await Promise.all([
    usersApi.list(),
    getCompanyBranches(),
    employeesApi.list(scope.companyId),
  ]);
  const companyBranchIds = new Set(branches.map((branch) => branch.id));
  const payrollProfileUserIds = new Set(employees.map((employee) => employee.userId));
  const result = users
    .filter(
      (user) =>
        user.companyAccess.some(
          (access) => access.company.id === scope.companyId,
        ) || user.companyAccess.length === 0,
    )
    .map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: roleFromApi(user),
      branches: user.branchAccess
        .filter((access) => companyBranchIds.has(access.branch.id))
        .map((access) => access.branch.id),
      active: user.status === "ACTIVE",
      hasEmployeeProfile: payrollProfileUserIds.has(user.id),
    }));
  usersSnapshot = new Map(result.map((user) => [user.id, user]));
  return result;
}

const randomPassword = () =>
  Array.from(
    { length: 20 },
    () =>
      "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"[
        Math.floor(Math.random() * 56)
      ],
  ).join("");

const roleToApi = {
  'Business Admin': 'BUSINESS_ADMIN',
  'Company Manager': 'COMPANY_MANAGER',
  'Branch Manager': 'BRANCH_MANAGER',
  'Sales Manager': 'SALES_MANAGER',
  'HR Manager': 'HR_MANAGER',
  'Payroll Officer': 'PAYROLL_MANAGER',
  Employee: 'EMPLOYEE',
} as const;

/** New accounts set their password through Forgot password on the sign-in screen. */
export async function saveAccessUsers(next: AccessUser[]): Promise<void> {
  if (!usersSnapshot) await readAccessUsers();
  const previous = usersSnapshot!;
  const scope = await getAdminScope();
  const branches = await getCompanyBranches();
  const idsFor = (ids: string[]) => {
    if (ids.some(id => !branches.some(branch => branch.id === id)))
      throw new Error('A selected branch is no longer available. Reload and try again.');
    return [...new Set(ids)];
  };
  try {
    for (const user of next) {
      const before = previous.get(user.id);
      if (before && JSON.stringify(before) === JSON.stringify(user)) continue;
      if (user.role === 'Business Owner') throw new Error('Business owner accounts cannot be changed here.');
      if (user.id === scope.user.id) throw new Error('You cannot change your own access.');
      if ((user.role === 'Business Admin' || before?.role === 'Business Admin') && scope.role !== 'BUSINESS_OWNER')
        throw new Error('Only a business owner can manage administrator roles.');
      let id = user.id;
      if (!before) {
        id = (
          await usersApi.create({
            name: user.name,
            email: user.email,
            password: randomPassword(),
          })
        ).id;
        const added = idsFor(user.branches);
        if (added.length)
          await usersApi.replaceAccess(id, scope.companyId, added);
        if (!user.active) await usersApi.deactivate(id);
        if (user.role !== 'Employee') await usersApi.setRole(id, roleToApi[user.role]);
        continue;
      }
      if (before.name !== user.name || before.email !== user.email)
        await usersApi.update(id, { name: user.name, email: user.email });
      if (JSON.stringify([...before.branches].sort()) !== JSON.stringify([...user.branches].sort()))
        await usersApi.replaceAccess(id, scope.companyId, idsFor(user.branches));
      if (before.active !== user.active)
        await (user.active ? usersApi.activate(id) : usersApi.deactivate(id));
      if (before.role !== user.role) await usersApi.setRole(id, roleToApi[user.role]);
    }
  } finally {
    usersSnapshot = null;
  }
}

// ---------------------------------------------------------------- workspace settings
export type WorkspaceSettings = {
  name: string;
  accent: number;
  companies: string[];
};

export async function readWorkspaceSettings(): Promise<WorkspaceSettings> {
  const scope = await getAdminScope();
  const [companies, preference] = await Promise.all([
    companiesApi.list(),
    workspacePreferencesApi.read(scope.companyId, 'workspace'),
  ]);
  let accent = preference?.value?.accent;
  if (!Number.isInteger(accent)) {
    const extras = await readExtras<number>(extrasKeys.workspace);
    accent = extras[scope.companyId] ?? 0;
    await workspacePreferencesApi.save(scope.companyId, 'workspace', { accent });
    delete extras[scope.companyId];
    await writeExtras(extrasKeys.workspace, extras);
  }
  return {
    name: scope.companyName,
    accent: Number.isInteger(accent) ? Number(accent) : 0,
    companies: companies.map((company) => company.name),
  };
}

export async function saveWorkspaceSettings(
  next: WorkspaceSettings,
): Promise<void> {
  const scope = await getAdminScope();
  const companies = await companiesApi.list();
  if (next.name.trim() && next.name.trim() !== scope.companyName)
    await companiesApi.rename(scope.companyId, next.name.trim());
  for (const name of next.companies) {
    const isCurrentRename = name === next.name && name !== scope.companyName;
    if (
      !isCurrentRename &&
      !companies.some((company) => company.name === name) &&
      name !== scope.companyName
    )
      await companiesApi.create(name.trim());
  }
  const preference = await workspacePreferencesApi.read(scope.companyId, 'workspace');
  await workspacePreferencesApi.save(scope.companyId, 'workspace', { ...preference?.value, accent: next.accent });
  invalidateAdminScope();
}
