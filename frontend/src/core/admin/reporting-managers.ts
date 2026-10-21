import type { EmployeeProfileDto, UserDto } from './api';

const managerRoles = [
  ['BUSINESS_OWNER', 'Business Owner'],
  ['BUSINESS_ADMIN', 'Business Admin'],
  ['BRANCH_MANAGER', 'Company Manager'],
  ['SALES_MANAGER', 'Sales Manager'],
  ['HR_MANAGER', 'HR Manager'],
  ['PAYROLL_MANAGER', 'Payroll Officer'],
] as const;

/** Add employee creates an EMPLOYEE account; these roles can supervise that account. */
export function reportingManagerOptions(
  users: UserDto[],
  profiles: EmployeeProfileDto[],
  companyId: string,
  branchId: string,
  employeeEmail = '',
): { value: string; label: string }[] {
  if (!companyId || !branchId) return [];
  const email = employeeEmail.trim().toLowerCase();
  return users.flatMap(user => {
    if (user.status !== 'ACTIVE' || (email && user.email.trim().toLowerCase() === email)) return [];
    const roles = new Set(user.roles.map(item => item.role.name));
    const managerRole = managerRoles.find(([role]) => roles.has(role));
    if (!managerRole) return [];

    const companyProfiles = profiles.filter(profile => profile.userId === user.id && profile.companyId === companyId);
    const owner = roles.has('BUSINESS_OWNER');
    const inCompany = user.companyAccess.some(access => access.company.id === companyId) || companyProfiles.length > 0;
    const inBranch = user.branchAccess.some(access => access.branch.id === branchId);
    if (!owner && (!inCompany || !inBranch)) return [];

    const branchProfiles = companyProfiles.filter(profile => profile.branchId === branchId);
    if (branchProfiles.length && !branchProfiles.some(profile => profile.status === 'ACTIVE')) return [];
    const profile = branchProfiles.find(profile => profile.status === 'ACTIVE')
      ?? companyProfiles.find(profile => profile.status === 'ACTIVE');
    if (companyProfiles.length && !profile) return [];
    const designation = profile?.designation?.trim() || managerRole[1];
    const department = profile?.department?.trim();
    const details = [user.name.trim(), designation, department].filter(Boolean);
    return [{ value: user.id, label: details.join(' · ') }];
  }).sort((a, b) => a.label.localeCompare(b.label) || a.value.localeCompare(b.value));
}
