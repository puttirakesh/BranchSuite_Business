import type { AppIconName } from './AppIcon';
import type { AuthSession } from '../core/api/client';
import { canOpenAdminPath } from '../core/admin/access';
import { RESPONSIVE_BREAKPOINTS } from './responsiveBreakpoints';

export type WorkspaceDestination = {
  label: string;
  href: string;
  icon: AppIconName;
  group: string;
  keywords?: string;
  match?: string[];
};

export const adminDestinations: WorkspaceDestination[] = [
  { label: 'Dashboard', href: '/admin/dashboard', icon: 'home', group: 'Overview' },
  { label: 'Reports', href: '/admin/reports', icon: 'bar-chart-2', group: 'Overview' },
  { label: 'CRM overview', href: '/admin/crm', icon: 'trending-up', group: 'Sales & work' },
  { label: 'Leads', href: '/admin/crm/leads', icon: 'users', group: 'Sales & work', match: ['/admin/crm/leads', '/admin/crm/lead', '/admin/crm/lead-form'] },
  { label: 'Opportunities', href: '/admin/crm/deals-live', icon: 'briefcase', group: 'Sales & work', keywords: 'deals pipeline', match: ['/admin/crm/deals', '/admin/crm/deals-live'] },
  { label: 'Quotations', href: '/admin/crm/quotes-live', icon: 'file-text', group: 'Sales & work', keywords: 'quotes', match: ['/admin/crm/quotes', '/admin/crm/quotes-live'] },
  { label: 'Customers', href: '/admin/crm/customers-live', icon: 'user-check', group: 'Sales & work', match: ['/admin/crm/customers-live', '/admin/crm/customers'] },
  { label: 'Activities & follow-ups', href: '/admin/crm/activities', icon: 'phone-call', group: 'Sales & work' },
  { label: 'Tasks', href: '/admin/tasks', icon: 'check-square', group: 'Sales & work', match: ['/admin/tasks'] },
  { label: 'Employees', href: '/admin/employees', icon: 'users', group: 'People', keywords: 'directory staff', match: ['/admin/employees'] },
  { label: 'Team attendance', href: '/admin/attendance/team', icon: 'clock', group: 'People', match: ['/admin/attendance/team', '/admin/attendance/corrections'] },
  { label: 'Leave management', href: '/admin/leave-management', icon: 'calendar', group: 'People' },
  { label: 'Approvals', href: '/admin/approvals', icon: 'check-circle', group: 'People' },
  { label: 'Payroll', href: '/admin/payroll', icon: 'credit-card', group: 'Payroll & finance', match: ['/admin/payroll'] },
  { label: 'Salary advances', href: '/admin/advances', icon: 'dollar-sign', group: 'Payroll & finance' },
  { label: 'Branches', href: '/admin/branches', icon: 'git-branch', group: 'Administration' },
  { label: 'Departments', href: '/admin/departments', icon: 'briefcase', group: 'Administration', keywords: 'teams employee department' },
  { label: 'Roles & access', href: '/admin/roles-permissions', icon: 'shield', group: 'Administration', keywords: 'permissions users' },
  { label: 'Activity history', href: '/admin/activity-audit', icon: 'activity', group: 'Administration', keywords: 'audit' },
  { label: 'Workspace settings', href: '/admin/workspace-settings', icon: 'settings', group: 'Administration' },
  { label: 'Subscription', href: '/admin/subscription', icon: 'package', group: 'Administration', keywords: 'plan' },
  { label: 'Billing', href: '/admin/billing', icon: 'file-text', group: 'Administration', keywords: 'invoices' },
  { label: 'Support', href: '/admin/platform-support', icon: 'help-circle', group: 'Administration', keywords: 'help tickets' },
  { label: 'My attendance', href: '/admin/attendance', icon: 'clock', group: 'My workspace' },
  { label: 'My payslips', href: '/admin/payslips', icon: 'file-text', group: 'My workspace' },
  { label: 'My profile', href: '/admin/profile', icon: 'user', group: 'My workspace', match: ['/admin/profile'] },
  { label: 'All modules', href: '/admin/more', icon: 'grid', group: 'My workspace' },
];

export const employeeDestinations: WorkspaceDestination[] = [
  { label: 'My work', href: '/employee/dashboard', icon: 'home', group: 'My work' },
  { label: 'My tasks', href: '/employee/tasks', icon: 'check-square', group: 'My work' },
  { label: 'Attendance', href: '/employee/attendance', icon: 'clock', group: 'My work' },
  { label: 'Leave & requests', href: '/employee/leave', icon: 'calendar', group: 'My work' },
  { label: 'Payslips', href: '/employee/payslips', icon: 'credit-card', group: 'Pay & documents', keywords: 'salary payroll' },
  { label: 'Salary advances', href: '/employee/advances', icon: 'dollar-sign', group: 'Pay & documents' },
  { label: 'My documents', href: '/employee/documents', icon: 'file-text', group: 'Pay & documents', keywords: 'letters employment' },
  { label: 'My profile', href: '/employee/profile', icon: 'user', group: 'Account & help' },
  { label: 'Help & support', href: '/employee/help', icon: 'help-circle', group: 'Account & help', keywords: 'tickets' },
];

export function activeDestination(items: WorkspaceDestination[], pathname: string) {
  return items.map(item => ({ item, length: Math.max(0, ...(item.match ?? [item.href]).filter(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`)).map(prefix => prefix.length)) }))
    .filter(entry => entry.length > 0).sort((a, b) => b.length - a.length)[0]?.item;
}

export function getAdminDestinations(session: AuthSession | null, companyId?: string) {
  return adminDestinations.map(item => item.href === '/admin/tasks' && !canOpenAdminPath(session, companyId, item.href)
    ? { ...item, href: '/admin/tasks/follow-ups' } : item).filter(item => canOpenAdminPath(session, companyId, item.href));
}

/** Core workspaces and frequently used admin modules, filtered by company access. */
export function getAdminSidebarDestinations(session: AuthSession | null, companyId?: string) {
  const core = new Set([
    '/admin/dashboard',
    '/admin/crm',
    '/admin/employees',
    '/admin/attendance/team',
    '/admin/leave-management',
    '/admin/approvals',
    '/admin/payroll',
    '/admin/departments',
    '/admin/reports',
    '/admin/more',
  ]);
  return getAdminDestinations(session, companyId)
    .filter(item => core.has(item.href))
    .map(item => item.href === '/admin/employees' ? { ...item, label: 'People' }
      : item.href === '/admin/more' ? { ...item, label: 'More' } : item);
}

/** Employee sidebar: daily work, time off, pay, and account access. */
export const employeeSidebarDestinations = employeeDestinations
  .filter(item => [
    '/employee/dashboard',
    '/employee/tasks',
    '/employee/attendance',
    '/employee/leave',
    '/employee/payslips',
    '/employee/profile',
  ].includes(item.href))
  .map(item => ({ ...item, group: 'My workspace' }));

export function filterDestinations(items: WorkspaceDestination[], search: string) {
  const terms = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return items.filter(item => terms.every(term => `${item.label} ${item.group} ${item.keywords ?? ''}`.toLowerCase().includes(term)));
}

export function webWorkspaceLayout(width: number) {
  const webNavigation = width >= RESPONSIVE_BREAKPOINTS.tablet;
  const persistentSidebar = width >= RESPONSIVE_BREAKPOINTS.desktop;
  const sidebarWidth = persistentSidebar ? 248 : 0;
  return { webNavigation, persistentSidebar, sidebarWidth };
}
