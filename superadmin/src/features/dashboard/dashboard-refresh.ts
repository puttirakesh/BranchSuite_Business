import { can, type Role } from '../../core/permissions/roles';

interface DashboardRefreshers {
  metrics: () => Promise<unknown>;
  customers: () => Promise<unknown>;
}

/** Refresh only data the current platform role may request. */
export function refreshDashboard(role: Role | null | undefined, refreshers: DashboardRefreshers) {
  const tasks = [refreshers.metrics()];
  if (can(role, 'customers.view')) tasks.push(refreshers.customers());
  return Promise.all(tasks);
}
