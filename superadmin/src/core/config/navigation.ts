import type { PlatformRole } from '../permissions/roles';

const adminNavigation = [
  { label: 'Dashboard', href: '/(admin)/dashboard' },
  { label: 'Customers', href: '/(admin)/customers' },
  { label: 'Plans', href: '/(admin)/plans' },
  { label: 'Billing', href: '/(admin)/billing' },
  { label: 'Support', href: '/(admin)/support' },
  { label: 'Marketing', href: '/(admin)/marketing' },
  { label: 'Offers', href: '/(admin)/offers' },
  { label: 'Settings', href: '/(admin)/settings' },
  { label: 'Audit', href: '/(admin)/audit' },
] as const;

const supportNavigation = [
  { label: 'Dashboard', href: '/(support)/dashboard' },
  { label: 'Customers', href: '/(support)/customers' },
  { label: 'Support', href: '/(support)/support' },
] as const;

export function navigationForRole(role: PlatformRole) {
  return role === 'PLATFORM_ADMIN' ? adminNavigation : supportNavigation;
}
