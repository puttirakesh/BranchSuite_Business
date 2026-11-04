import type { IconName } from '../../shared/components/Icon';
import type { Capability } from '../permissions/roles';

export interface NavItem {
  label: string;
  href: string;
  icon: IconName;
  capability: Capability;
  /** Shown in the phone bottom bar (APK shows 4 items plus More). */
  primary?: 'all' | 'admin' | 'support';
}

/** Sidebar order matches the APK desktop sidebar (workspace-ui.js `menuItems`). */
export const NAV_ITEMS: NavItem[] = [
  { label: 'Overview', href: '/dashboard', icon: 'home', capability: 'dashboard.view', primary: 'all' },
  { label: 'Customers', href: '/customers', icon: 'building', capability: 'customers.view', primary: 'all' },
  { label: 'Plans', href: '/plans', icon: 'wallet', capability: 'plans.manage', primary: 'admin' },
  { label: 'Billing', href: '/billing', icon: 'quote', capability: 'billing.view', primary: 'admin' },
  { label: 'Marketing', href: '/marketing', icon: 'leads', capability: 'marketing.manage' },
  { label: 'Offers', href: '/offers', icon: 'star', capability: 'offers.manage' },
  { label: 'Support', href: '/support', icon: 'support', capability: 'support.view', primary: 'support' },
  { label: 'Settings', href: '/settings', icon: 'settings', capability: 'settings.manage' },
  { label: 'Audit history', href: '/audit', icon: 'doc', capability: 'audit.view' },
];

/** Which top-level section a pathname belongs to, for highlighting nav items. */
export function sectionOf(pathname: string): string {
  const first = pathname.split('/').filter(Boolean)[0];
  return first ? '/' + first : '/';
}
