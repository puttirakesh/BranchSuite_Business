/**
 * Admin tasks ⇄ backend CRM activities (/activities).
 *
 *  Task.type      Task | Follow-up | Call | Meeting   ⇄  TASK | FOLLOW_UP | CALL | MEETING
 *  Task.status    completed / cancelled               ⇄  COMPLETED / CANCELLED
 *                 open / in_progress / pending         ⇄  PENDING ("in progress" kept on device)
 *  employeeId     ⇄ assignedToId,  dueDate ⇄ scheduledAt,  instructions ⇄ description,  branch ⇄ branchId
 *
 * Priority, collaborators, assign date, related-lead text and the progress history have no
 * backend columns and are kept on this device. Calls/meetings logged from a lead are not tasks
 * and are skipped (see CRM_LOG_MARKER).
 */
import { activitiesApi, type ActivityDto, type ActivityType } from './api';
import { getAdminScope, getCompanyBranches, branchNameMap, resolveBranchId } from './scope';
import { displayDateToTimestamp, extrasKeys, readExtras, timestampToDisplayDate, writeExtras } from './local';
import { CRM_LOG_MARKER } from '../leads';

export type TaskStatus = 'pending' | 'open' | 'in_progress' | 'completed' | 'cancelled';
export type AdminTask = {
  id: string; createdAt: string; title: string; type: string; branch: string; employeeId: string;
  dueDate: string; assignDate: string; priority: string; relatedLead: string; instructions: string;
  status: TaskStatus; assignedBy?: string; collaboratorIds?: string[];
  history?: { id: string; createdAt: string; status: TaskStatus; note: string; kind: 'progress' | 'edit' }[];
};
type TaskExtras = Pick<AdminTask, 'priority' | 'relatedLead' | 'assignDate' | 'collaboratorIds' | 'history'> & { openStatus?: TaskStatus };

const typeToApi: Record<string, ActivityType> = { Task: 'TASK', 'Follow-up': 'FOLLOW_UP', Call: 'CALL', Meeting: 'MEETING' };
const typeFromApi: Record<ActivityType, string> = { TASK: 'Task', FOLLOW_UP: 'Follow-up', CALL: 'Call', MEETING: 'Meeting', EMAIL: 'Task' };

let snapshot: Map<string, { task: AdminTask; dto: ActivityDto }> | null = null;

export async function readTasks(): Promise<AdminTask[]> {
  const scope = await getAdminScope();
  const [activities, branches, extras] = await Promise.all([
    activitiesApi.list(scope.companyId), getCompanyBranches(), readExtras<TaskExtras>(extrasKeys.tasks),
  ]);
  const names = branchNameMap(branches);
  const result = activities
    .filter(activity => !activity.description?.startsWith(CRM_LOG_MARKER))
    .map(dto => {
      const extra = extras[dto.id];
      const status: TaskStatus = dto.status === 'COMPLETED' ? 'completed' : dto.status === 'CANCELLED' ? 'cancelled' : extra?.openStatus ?? 'open';
      const task: AdminTask = {
        id: dto.id,
        createdAt: dto.createdAt,
        title: dto.title,
        type: typeFromApi[dto.type],
        branch: dto.branchId ? names.get(dto.branchId) ?? '' : '',
        employeeId: dto.assignedToId ?? '',
        dueDate: timestampToDisplayDate(dto.scheduledAt),
        assignDate: extra?.assignDate || timestampToDisplayDate(dto.createdAt),
        priority: extra?.priority || 'Normal',
        relatedLead: extra?.relatedLead ?? '',
        instructions: dto.description ?? '',
        status,
        assignedBy: dto.createdById === scope.user.id ? scope.user.name : undefined,
        collaboratorIds: extra?.collaboratorIds ?? [],
        history: extra?.history ?? [],
      };
      return { task, dto };
    });
  snapshot = new Map(result.map(item => [item.task.id, item]));
  return result.map(item => item.task);
}

export async function saveTasks(next: AdminTask[]): Promise<void> {
  if (!snapshot) await readTasks();
  const previous = snapshot!;
  const scope = await getAdminScope();
  const branches = (await getCompanyBranches()).filter(branch => branch.status === 'ACTIVE');
  const extras = await readExtras<TaskExtras>(extrasKeys.tasks);
  const extrasFor = (task: AdminTask): TaskExtras => ({
    priority: task.priority, relatedLead: task.relatedLead, assignDate: task.assignDate,
    collaboratorIds: task.collaboratorIds, history: task.history,
    openStatus: task.status === 'in_progress' ? 'in_progress' : undefined,
  });

  try {
    for (const task of next) {
      const before = previous.get(task.id)?.task;
      if (before && JSON.stringify(before) === JSON.stringify(task)) continue;
      const scheduledAt = displayDateToTimestamp(task.dueDate) ?? new Date().toISOString();
      const branchId = resolveBranchId(branches, task.branch);

      if (!before) {
        const created = await activitiesApi.create({
          companyId: scope.companyId, ...(branchId ? { branchId } : {}),
          title: task.title.trim(), type: typeToApi[task.type] ?? 'TASK', scheduledAt,
          ...(task.instructions.trim() ? { description: task.instructions.trim() } : {}),
          assignedToId: task.employeeId || null,
        });
        extras[created.id] = extrasFor(task);
        if (task.status === 'completed') await activitiesApi.complete(created.id);
        else if (task.status === 'cancelled') await activitiesApi.cancel(created.id);
        await writeExtras(extrasKeys.tasks, extras);
        continue;
      }

      const fieldsChanged = before.title !== task.title || before.type !== task.type || before.dueDate !== task.dueDate
        || before.instructions !== task.instructions || before.employeeId !== task.employeeId;
      if (fieldsChanged) {
        await activitiesApi.update(task.id, {
          title: task.title.trim(), type: typeToApi[task.type] ?? 'TASK', scheduledAt,
          description: task.instructions.trim() || null, assignedToId: task.employeeId || null,
        });
      }
      if (before.status !== task.status) {
        if (task.status === 'completed') await activitiesApi.complete(task.id);
        else if (task.status === 'cancelled') await activitiesApi.cancel(task.id);
        else if (before.status === 'completed' || before.status === 'cancelled') {
          throw new Error('Completed or cancelled tasks cannot be reopened.');
        }
      }
      extras[task.id] = extrasFor(task);
      await writeExtras(extrasKeys.tasks, extras);
    }
  } finally {
    snapshot = null;
  }
}
