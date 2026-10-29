import { api } from '../api/client';
import { call } from './http';
import { getAdminScope, getBranchDirectory, branchNameMap } from './scope';
import { fromDisplayDate, timestampToDisplayDate } from './local';
import { getAvailableBranches } from './available-branches';

export type TaskStatus = 'pending' | 'open' | 'in_progress' | 'completed' | 'cancelled';
export type AdminTask = {
  employeeName?: string; id: string; createdAt: string; title: string; type: string; branch: string; employeeId: string;
  dueDate: string; assignDate: string; priority: string; relatedLead: string; instructions: string;
  status: TaskStatus; assignedBy?: string; collaboratorIds?: string[];
  history?: { id: string; createdAt: string; status: TaskStatus; note: string; kind: 'progress' | 'edit' }[];
};
type ServerTask = {
  id: string; createdAt: string; title: string; branchId: string; assignedToId: string;
  dueDate: string | null; priority: string; description: string | null; status: string; createdBy?: { name: string }; assignedTo?: { name: string };
};
const statuses: Record<TaskStatus, string> = { open: 'TODO', pending: 'ON_HOLD', in_progress: 'IN_PROGRESS', completed: 'COMPLETED', cancelled: 'CANCELLED' };

/** Reports and compatibility screens use the same task records as both workspaces. */
export async function readTasks(): Promise<AdminTask[]> {
  const scope = await getAdminScope();
  const [tasks, branches] = await Promise.all([
    call(api.get<ServerTask[]>('/tasks', { params: { companyId: scope.companyId } })), getBranchDirectory(),
  ]);
  const names = branchNameMap(branches);
  return tasks.map(task => ({
    id: task.id, employeeName: task.assignedTo?.name, createdAt: task.createdAt, title: task.title, type: 'Task',
    branch: names.get(task.branchId) ?? '', employeeId: task.assignedToId,
    dueDate: timestampToDisplayDate(task.dueDate), assignDate: timestampToDisplayDate(task.createdAt),
    priority: task.priority, instructions: task.description ?? '', relatedLead: '', assignedBy: task.createdBy?.name,
    status: task.status === 'COMPLETED' ? 'completed' : task.status === 'CANCELLED' ? 'cancelled' : task.status === 'IN_PROGRESS' ? 'in_progress' : task.status === 'ON_HOLD' ? 'pending' : 'open',
  }));
}

export async function saveTasks(next: AdminTask[]): Promise<void> {
  const scope = await getAdminScope();
  const before = new Map((await readTasks()).map(task => [task.id, task]));
  const branches = await getAvailableBranches();
  for (const task of next) {
    const current = before.get(task.id);
    if (current && JSON.stringify(current) === JSON.stringify(task)) continue;
    const branchId = branches.find(branch => branch.name === task.branch)?.id;
    if (!branchId || !task.employeeId || !task.title.trim()) throw new Error('Choose a branch, an employee, and a task title.');
    const dueDate = task.dueDate.trim() ? fromDisplayDate(task.dueDate) : null;
    if (task.dueDate.trim() && !dueDate) throw new Error('Enter a valid task due date.');
    if (current && current.branch !== task.branch) throw new Error('Task branches cannot be changed. Create a task in the intended branch.');
    const priority = task.priority === 'Normal' ? 'MEDIUM' : task.priority.toUpperCase();
    const body = { title: task.title.trim(), description: task.instructions.trim(), assignedToId: task.employeeId, priority, ...(dueDate ? { dueDate: `${dueDate}T00:00:00.000Z` } : {}) };
    let id = task.id;
    if (!current) {
      if (/^[0-9a-f]{8}-/i.test(id)) throw new Error('This task is no longer available in the current workspace.');
      const created = await call(api.post<ServerTask>('/tasks', { companyId: scope.companyId, branchId, ...body }));
      id = created.id;
    } else if (current.title !== task.title || current.instructions !== task.instructions || current.employeeId !== task.employeeId || current.priority !== priority || current.dueDate !== task.dueDate) {
      await call(api.patch(`/tasks/${id}`, { ...body, dueDate: dueDate ? `${dueDate}T00:00:00.000Z` : null }));
    }
    if ((current?.status ?? 'open') !== task.status) await call(api.patch(`/tasks/${id}/status`, { status: statuses[task.status] }));
    const known = new Set(current?.history?.map(entry => entry.id) ?? []);
    for (const entry of task.history ?? []) if (!known.has(entry.id) && entry.note.trim()) await call(api.post(`/tasks/${id}/comments`, { message: entry.note.trim() }));
  }
}
