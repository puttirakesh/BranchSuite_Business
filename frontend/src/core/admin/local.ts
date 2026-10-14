import AsyncStorage from '@react-native-async-storage/async-storage';

// ---------------------------------------------------------------- dates
const pad = (value: number) => String(value).padStart(2, '0');

/** Today's date in the device's timezone as YYYY-MM-DD. */
export function localIsoDate(date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Backend @db.Date values arrive as "2026-10-13T00:00:00.000Z" — keep the calendar date. */
export function dateOnly(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : '';
}

/** YYYY-MM-DD → DD/MM/YYYY (the format the admin pages use). */
export function toDisplayDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '';
}

/** DD/MM/YYYY or DD-MM-YYYY → YYYY-MM-DD, or null when invalid. */
export function fromDisplayDate(value: string): string | null {
  const match = /^(\d{2})[/-](\d{2})[/-](\d{4})$/.exec(value.trim());
  if (!match) return null;
  const date = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
  if (date.getFullYear() !== Number(match[3]) || date.getMonth() !== Number(match[2]) - 1 || date.getDate() !== Number(match[1])) return null;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

/** ISO timestamp → DD/MM/YYYY in the device's timezone. */
export function timestampToDisplayDate(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/** ISO timestamp → "9:05 AM". */
export function timeLabel(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const hours = date.getHours();
  return `${hours % 12 || 12}:${pad(date.getMinutes())} ${hours >= 12 ? 'PM' : 'AM'}`;
}

/** DD/MM/YYYY → ISO timestamp at 10:00 local time (used for activity scheduledAt). */
export function displayDateToTimestamp(value: string): string | null {
  const iso = fromDisplayDate(value);
  if (!iso) return null;
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day, 10, 0, 0).toISOString();
}

export const toMoney = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

// ---------------------------------------------------------------- device-local extras
/**
 * Some fields used by the admin UI have no backend column yet (lead source, quotes,
 * task priority, branch location, …). They are kept on this device, keyed by the
 * backend record id, so the server data stays the source of truth for everything else.
 */
export async function readExtras<T>(key: string): Promise<Record<string, T>> {
  try {
    const raw = await AsyncStorage.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, T> : {};
  } catch {
    return {};
  }
}

export async function writeExtras<T>(key: string, value: Record<string, T>): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export const extrasKeys = {
  leads: 'branchsuite:api:lead-extras:v1',
  tasks: 'branchsuite:api:task-extras:v1',
  branches: 'branchsuite:api:branch-extras:v1',
  workspace: 'branchsuite:api:workspace-extras:v1',
  corrections: 'branchsuite:api:attendance-corrections:v1',
} as const;
