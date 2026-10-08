import AsyncStorage from '@react-native-async-storage/async-storage';

export interface LocalTask {
  id: string; title: string; type: string; assigneeId: string; assigneeName: string;
  dueDate: string; dueTime: string; priority: string; description: string; createdAt: string;
}
const key = 'branchsuite.local.tasks.v1';
function isTask(value: unknown): value is LocalTask {
  return !!value && typeof value === 'object' && ['id', 'title', 'type', 'assigneeId', 'assigneeName', 'dueDate', 'dueTime', 'priority', 'description', 'createdAt']
    .every(field => typeof (value as Record<string, unknown>)[field] === 'string');
}
export async function readLocalTasks(): Promise<LocalTask[]> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return [];
  const records: unknown = JSON.parse(raw);
  if (!Array.isArray(records) || !records.every(isTask)) throw new Error('Saved tasks could not be read.');
  return records;
}
let pending: Promise<unknown> = Promise.resolve();
export function saveLocalTask(task: LocalTask): Promise<LocalTask[]> {
  const write = pending.catch(() => undefined).then(async () => {
    const records = await readLocalTasks();
    const next = [task, ...records.filter(record => record.id !== task.id)];
    await AsyncStorage.setItem(key, JSON.stringify(next));
    return next;
  });
  pending = write;
  return write;
}
