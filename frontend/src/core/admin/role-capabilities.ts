import type { AuthSession } from '../api/client';

export const roleLabels: Record<string, string> = {
  BUSINESS_OWNER: 'Business Owner', BUSINESS_ADMIN: 'Business Admin', COMPANY_MANAGER: 'Company Manager',
  BRANCH_MANAGER: 'Branch Manager', HR_MANAGER: 'HR Manager', PAYROLL_MANAGER: 'Payroll Officer',
  SALES_MANAGER: 'Sales Executive', EMPLOYEE: 'Employee',
};
export const companyRoles = (session: AuthSession | null, companyId?: string) => [...new Set(
  (session?.memberships ?? []).filter(item => !companyId || item.companyId === companyId).flatMap(item => item.roles ?? [item.role]),
)];
export const canPreparePayroll = (roles: string[]) => roles.some(role => ['BUSINESS_OWNER', 'BUSINESS_ADMIN', 'PAYROLL_MANAGER'].includes(role));
export const canApprovePayroll = (roles: string[]) => roles.some(role => ['COMPANY_MANAGER', 'BRANCH_MANAGER'].includes(role));
export const canManageEmployees = (roles: string[]) => roles.some(role => ['BUSINESS_OWNER', 'BUSINESS_ADMIN', 'HR_MANAGER'].includes(role));
export const canManageTasks = (roles: string[]) => roles.some(role => ['BUSINESS_OWNER', 'BUSINESS_ADMIN', 'COMPANY_MANAGER', 'BRANCH_MANAGER', 'SALES_MANAGER'].includes(role));

export type RoleTab = { label: string; route: string; icon: 'home' | 'trending-up' | 'users' | 'credit-card' | 'more-horizontal' | 'clock' | 'check-circle' | 'check-square' | 'dollar-sign' };
export function roleTabs(roles: string[]): RoleTab[] {
  const home: RoleTab = { label: 'Home', route: '/admin/dashboard', icon: 'home' };
  const more: RoleTab = { label: 'More', route: '/admin/more', icon: 'more-horizontal' };
  const team: RoleTab = { label: 'Team', route: '/admin/employees/people', icon: 'users' };
  const crm: RoleTab = { label: 'CRM', route: '/admin/crm', icon: 'trending-up' };
  const payroll: RoleTab = { label: 'Payroll', route: '/admin/payroll', icon: 'credit-card' };
  const approvals: RoleTab = { label: 'Approvals', route: '/admin/approvals', icon: 'check-circle' };
  if (roles.some(role => ['BUSINESS_OWNER', 'BUSINESS_ADMIN'].includes(role))) return [home, crm, { ...team, label: 'People' }, payroll, more];
  if (roles.some(role => ['COMPANY_MANAGER', 'BRANCH_MANAGER'].includes(role))) return [home, crm, team, approvals, more];
  if (roles.includes('HR_MANAGER')) return [home, team, { label: 'Attendance', route: '/admin/attendance/team', icon: 'clock' }, approvals, more];
  if (roles.includes('PAYROLL_MANAGER')) return [home, team, payroll, { label: 'Payments', route: '/admin/payroll?view=payments', icon: 'dollar-sign' }, more];
  if (roles.includes('SALES_MANAGER')) return [home, { label: 'Leads', route: '/admin/crm/leads', icon: 'users' }, { label: 'Deals', route: '/admin/crm/deals-live', icon: 'trending-up' }, { label: 'Tasks', route: '/admin/tasks/follow-ups', icon: 'check-square' }, more];
  return [];
}

export function activeRoleTab(tabs: RoleTab[], pathname: string, view?: string): string {
  const matches = (label: string) => label === 'Home' ? pathname.startsWith('/admin/dashboard')
    : ['Team', 'People'].includes(label) ? pathname.startsWith('/admin/employees')
    : label === 'Payments' ? pathname.startsWith('/admin/payroll') && view === 'payments'
    : label === 'Payroll' ? pathname.startsWith('/admin/payroll') && !(view === 'payments' && tabs.some(tab => tab.label === 'Payments'))
    : label === 'Attendance' ? pathname.startsWith('/admin/attendance/team')
    : label === 'Approvals' ? /^\/admin\/(approvals|attendance\/corrections|leave-management)/.test(pathname)
    : label === 'CRM' ? /^\/admin\/(crm|tasks)/.test(pathname)
    : label === 'Leads' ? /^\/admin\/crm\/(leads|lead\/|lead-form)/.test(pathname)
    : label === 'Deals' ? pathname.startsWith('/admin/crm/deals')
    : label === 'Tasks' ? pathname.startsWith('/admin/tasks') : false;
  return tabs.find(tab => matches(tab.label))?.label ?? 'More';
}
