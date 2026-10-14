export function formatTaskDate(date: Date): string {
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

export function getTaskAssignDate(task: { assignDate?: string; createdAt: string }): string {
  if (task.assignDate) return task.assignDate;
  const created = new Date(task.createdAt);
  return Number.isNaN(created.getTime()) ? '' : formatTaskDate(created);
}
