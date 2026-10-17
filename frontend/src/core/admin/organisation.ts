/**
 * Company structure for the admin pages:
 *  - branches page      ⇄ /branches (name, active/inactive); code, location and manager kept on device
 *  - roles & access     ⇄ /users (name, email, active) + /users/:id/access (branch access)
 *  - workspace settings ⇄ /companies (company name, add company); accent colour kept on device
 */
import { branchesApi, companiesApi, usersApi, type UserDto } from "./api";
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
  | "Business Admin"
  | "Company Manager"
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
};

const roleFromApi = (user: UserDto): AccessRole => {
  const names = user.roles.map((item) => item.role.name);
  if (names.includes("BUSINESS_OWNER") || names.includes("BUSINESS_ADMIN"))
    return "Business Admin";
  if (names.includes("BRANCH_MANAGER") || names.includes("SALES_MANAGER"))
    return "Company Manager";
  if (names.includes("HR_MANAGER")) return "HR Manager";
  if (names.includes("PAYROLL_MANAGER")) return "Payroll Officer";
  return "Employee";
};

let usersSnapshot: Map<string, AccessUser> | null = null;

export async function readAccessUsers(): Promise<AccessUser[]> {
  const scope = await getAdminScope();
  const [users, branches] = await Promise.all([
    usersApi.list(),
    getCompanyBranches(),
  ]);
  const companyBranchIds = new Set(branches.map((branch) => branch.id));
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
        .map((access) => access.branch.name),
      active: user.status === "ACTIVE",
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

/**
 * New users are created with the EMPLOYEE role (the only role the backend lets admins assign)
 * and a random password — they set their own with "Forgot password" on the sign-in screen.
 */
export async function saveAccessUsers(next: AccessUser[]): Promise<void> {
  if (!usersSnapshot) await readAccessUsers();
  const previous = usersSnapshot!;
  const scope = await getAdminScope();
  const branches = await getCompanyBranches();
  const idsFor = (names: string[]) =>
    names
      .map((name) => branches.find((branch) => branch.name === name)?.id)
      .filter((id): id is string => Boolean(id));
  try {
    for (const user of next) {
      const before = previous.get(user.id);
      if (before && JSON.stringify(before) === JSON.stringify(user)) continue;
      let id = user.id;
      if (!before) {
        if (user.role !== "Employee")
          throw new Error(
            "New users can only be added with the Employee role. Other roles are assigned by the platform administrator.",
          );
        id = (
          await usersApi.create({
            name: user.name,
            email: user.email,
            password: randomPassword(),
          })
        ).id;
        const added = idsFor(user.branches);
        if (added.length)
          await usersApi.grantAccess(id, scope.companyId, added);
        if (!user.active) await usersApi.deactivate(id);
        continue;
      }
      if (before.role !== user.role)
        throw new Error("Changing roles is not supported by the backend yet.");
      if (before.name !== user.name || before.email !== user.email)
        await usersApi.update(id, { name: user.name, email: user.email });
      const added = idsFor(
        user.branches.filter((name) => !before.branches.includes(name)),
      );
      const removed = idsFor(
        before.branches.filter((name) => !user.branches.includes(name)),
      );
      if (added.length) await usersApi.grantAccess(id, scope.companyId, added);
      if (removed.length)
        await usersApi.revokeAccess(id, scope.companyId, removed);
      if (before.active !== user.active)
        await (user.active ? usersApi.activate(id) : usersApi.deactivate(id));
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
  const [companies, extras] = await Promise.all([
    companiesApi.list(),
    readExtras<number>(extrasKeys.workspace),
  ]);
  return {
    name: scope.companyName,
    accent: Number.isInteger(extras[scope.companyId])
      ? extras[scope.companyId]
      : 0,
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
  const extras = await readExtras<number>(extrasKeys.workspace);
  extras[scope.companyId] = next.accent;
  await writeExtras(extrasKeys.workspace, extras);
  invalidateAdminScope();
}
