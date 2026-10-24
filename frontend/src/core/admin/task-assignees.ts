import { api } from '../api/client';
import { call } from './http';
import { getAdminScope } from './scope';
import type { Employee } from '../employees';

/** Task assignment exposes names and assigned branches, without HR or bank records. */
export async function getTaskAssignees(): Promise<Employee[]> {
  const scope = await getAdminScope();
  const rows = await call(api.get<{ userId: string; user: { name: string }; branch: { id: string; name: string } }[]>('/tasks/assignees', { params: { companyId: scope.companyId } }));
  return rows.map(row => ({ id: row.userId, fullName: row.user.name, branch: row.branch.name, branchId: row.branch.id,
    email: '', phone: '', jobTitle: '', department: '', reportingManager: '', joiningDate: '', createdAt: '', status: 'active' }));
}
