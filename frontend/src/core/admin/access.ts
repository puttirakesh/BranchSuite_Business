import type { AuthSession } from '../api/client';

const businessAdmins = ['BUSINESS_OWNER', 'BUSINESS_ADMIN'];
export function isBusinessAdminRole(role?: string) { return !!role && businessAdmins.includes(role); }

/** Mirrors server capabilities. Server-side checks remain authoritative. */
export function canOpenAdminPath(session: AuthSession | null, companyId: string | undefined, pathname: string): boolean {
  const roles = [...new Set((session?.memberships ?? []).filter(membership => !companyId || membership.companyId === companyId).flatMap(membership => membership.roles ?? [membership.role]))];
  if (roles.some(isBusinessAdminRole)) return true;
  if (!roles.some(role => ['BRANCH_MANAGER', 'SALES_MANAGER', 'HR_MANAGER', 'PAYROLL_MANAGER'].includes(role))) return false;
  const normalized = pathname.replace(/\/$/, '');
  if (['/admin/dashboard', '/admin/more'].includes(normalized) || /^\/admin\/profile(\/|$)/.test(normalized)) return true;
  if (normalized === '/admin/attendance') return roles.some(role => ['BRANCH_MANAGER', 'HR_MANAGER', 'PAYROLL_MANAGER'].includes(role));
  if (normalized === '/admin/payslips') return roles.includes('PAYROLL_MANAGER');
  if (/^\/admin\/tasks(\/|$)/.test(pathname)) return false;
  if (/^\/admin\/(branches|roles-permissions|activity-audit|workspace-settings|subscription|billing)(\/|$)/.test(pathname)) return false;
  if (pathname === '/admin/employees/create') return false;
  if (roles.includes('PAYROLL_MANAGER') && /^\/admin\/employees\/[^/]+\/edit/.test(pathname)) return false;
  if (pathname === '/admin/attendance/team') return roles.some(role => ['BRANCH_MANAGER', 'HR_MANAGER'].includes(role));
  if (/^\/admin\/(payroll|salary|advances)(\/|$)/.test(pathname)) return roles.includes('PAYROLL_MANAGER');
  if (/^\/admin\/(crm|teamlead)(\/|$)/.test(pathname)) return roles.some(role => ['BRANCH_MANAGER', 'SALES_MANAGER'].includes(role));
  if (/^\/admin\/(leave-management)(\/|$)/.test(pathname)) return roles.includes('HR_MANAGER');
  if (/^\/admin\/(approvals|attendance\/corrections)(\/|$)/.test(pathname)) return roles.some(role => ['BRANCH_MANAGER', 'HR_MANAGER'].includes(role));
  if (/^\/admin\/employees(\/|$)/.test(pathname)) return roles.some(role => ['BRANCH_MANAGER', 'HR_MANAGER', 'PAYROLL_MANAGER'].includes(role));
  if (/^\/admin\/reports(\/|$)/.test(pathname)) return roles.some(role => ['BRANCH_MANAGER', 'HR_MANAGER', 'PAYROLL_MANAGER'].includes(role));
  return false;
}
