import type { AuthSession } from '../api/client';
import { companyRoles, canManageEmployees, canManageTasks, canPreparePayroll, canApprovePayroll } from './role-capabilities';
const businessAdmins = ['BUSINESS_OWNER', 'BUSINESS_ADMIN'];
export function isBusinessAdminRole(role?: string) { return !!role && businessAdmins.includes(role); }
export function canOpenAdminPath(session: AuthSession | null, companyId: string | undefined, pathname: string): boolean {
  const roles = companyRoles(session, companyId);
  const has = (...allowed: string[]) => roles.some(role => allowed.includes(role));
  const path = pathname.split(/[?#]/)[0].replace(/\/$/, '');
  if (!has(...businessAdmins, 'COMPANY_MANAGER', 'BRANCH_MANAGER', 'SALES_MANAGER', 'HR_MANAGER', 'PAYROLL_MANAGER')) return false;
  if (['/admin/dashboard', '/admin/more', '/admin/attendance', '/admin/payslips', '/admin/my-leave', '/admin/my-advances'].includes(path) || /^\/admin\/profile(\/|$)/.test(path)) return true;
  if (/^\/admin\/(branches|departments|roles-permissions|activity-audit|workspace-settings|subscription|billing|platform-support)(\/|$)/.test(path)) return roles.some(isBusinessAdminRole);
  if (/^\/admin\/tasks(\/|$)/.test(path)) return canManageTasks(roles);
  if (path === '/admin/employees/create' || /^\/admin\/employees\/[^/]+\/edit$/.test(path)) return canManageEmployees(roles);
  if (/^\/admin\/employees(\/|$)/.test(path)) return has(...businessAdmins, 'COMPANY_MANAGER', 'BRANCH_MANAGER', 'HR_MANAGER', 'PAYROLL_MANAGER');
  if (path === '/admin/attendance/team') return has(...businessAdmins, 'COMPANY_MANAGER', 'BRANCH_MANAGER', 'HR_MANAGER', 'PAYROLL_MANAGER');
  if (/^\/admin\/(approvals|attendance\/corrections|leave-management)(\/|$)/.test(path)) return has(...businessAdmins, 'COMPANY_MANAGER', 'BRANCH_MANAGER', 'HR_MANAGER');
  if (path === '/admin/advances') return has(...businessAdmins, 'COMPANY_MANAGER', 'BRANCH_MANAGER', 'HR_MANAGER', 'PAYROLL_MANAGER');
  if (/^\/admin\/(payroll|salary|advances)(\/|$)/.test(path)) return canPreparePayroll(roles) || canApprovePayroll(roles);
  if (/^\/admin\/(crm|teamlead)(\/|$)/.test(path)) return canManageTasks(roles);
  if (/^\/admin\/reports(\/|$)/.test(path)) return true;
  return roles.some(isBusinessAdminRole);
}
