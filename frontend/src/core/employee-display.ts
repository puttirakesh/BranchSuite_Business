/** Use the persisted HR code for display; user/profile UUIDs are API keys only. */
export function employeeDisplayId(employee?: { employeeCode?: string | null } | null): string {
  return employee?.employeeCode?.trim() || 'Not assigned';
}
