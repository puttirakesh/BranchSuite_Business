/**
 * Role model. Frontend checks only decide what the UI shows; the backend
 * (PlatformRolesGuard) is the real authority and is enforced on every request.
 */
export const ROLES = ['PLATFORM_ADMIN', 'PLATFORM_SUPPORT'] as const;
export type Role = (typeof ROLES)[number];

export const roleLabel: Record<Role, string> = {
  PLATFORM_ADMIN: 'Platform Admin',
  PLATFORM_SUPPORT: 'Platform Support',
};

export type Capability =
  | 'dashboard.view'
  | 'customers.view'
  | 'customers.manageLicence'
  | 'plans.manage'
  | 'billing.view'
  | 'support.businesses.view'
  | 'support.view'
  | 'support.reply'
  | 'support.internalNote'
  | 'support.changeStatus'
  | 'marketing.manage'
  | 'offers.manage'
  | 'settings.manage'
  | 'audit.view';

/**
 * From the APK (saas-ui.js `allowed` + platformOwner checks):
 * Support may open Overview and Support. Customer records remain restricted to
 * administrators until the backend exposes a ticket-scoped customer projection.
 * `support.changeStatus` (status and priority) is granted to both platform roles, matching the
 * backend least-privilege policy; Billing, Offers, Settings, Customers and Audit stay Admin-only.
 */
const grants: Record<Role, readonly Capability[]> = {
  PLATFORM_ADMIN: [
    'dashboard.view', 'customers.view', 'customers.manageLicence', 'plans.manage', 'billing.view',
    'support.businesses.view', 'support.view', 'support.reply', 'support.internalNote', 'support.changeStatus',
    'marketing.manage', 'offers.manage', 'settings.manage', 'audit.view',
  ],
  PLATFORM_SUPPORT: ['dashboard.view', 'support.businesses.view', 'support.view', 'support.reply', 'support.internalNote', 'support.changeStatus'],
};

export function can(role: Role | null | undefined, capability: Capability): boolean {
  return !!role && grants[role].includes(capability);
}

export const isRole = (value: unknown): value is Role => ROLES.includes(value as Role);
