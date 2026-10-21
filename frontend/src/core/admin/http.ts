import axios from 'axios';

/**
 * Turns a backend / network failure into a sentence the admin pages can show.
 * NestJS errors look like { statusCode, message: string | string[], error }.
 */
export function apiErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const response = typeof error === 'object' && error !== null && 'response' in error
    ? (error as { response?: { status?: number; data?: { message?: unknown } } }).response : undefined;
  if (response) {
    if (response.status === 401) return 'Your session has expired. Please sign in again.';
    if (response.status === 403) return 'You do not have permission to do this.';
    if (response.status === 429) return 'Too many requests. Please wait a moment and try again.';
    if (response.status && response.status >= 500) return 'The server could not complete your request. Please try again.';
    return readableMessage(response.data?.message, fallback);
  }
  if (axios.isAxiosError(error)) return 'Cannot reach the server. Check your connection and try again.';
  if (error instanceof Error && error.message) return readableMessage(error.message, fallback);
  return fallback;
}

function readableMessage(message: unknown, fallback: string): string {
  if (Array.isArray(message)) {
    const messages = message.filter((entry): entry is string => typeof entry === 'string' && !!entry.trim());
    return messages.length ? [...new Set(messages.map(entry => readableMessage(entry, fallback)))].join(' ') : fallback;
  }
  if (typeof message !== 'string' || !message.trim()) return fallback;
  if (/cannot\s+(?:get|post|put|patch|delete|head|options)\s/i.test(message)) return 'This service is currently unavailable. Please try again later.';
  if (/uuid/i.test(message)) return 'Some saved information is out of date. Refresh this screen and try again.';
  if (/https?:\/\/|\b(?:prisma|SQLSTATE|ECONN\w*)\b|Cannot read properties|is not a function/i.test(message)) return fallback;
  return message.trim();
}

/** Awaits an axios call and rethrows failures as a plain Error with a readable message. */
export async function call<T>(request: Promise<{ data: T }>, fallback?: string): Promise<T> {
  try {
    return (await request).data;
  } catch (error) {
    throw new Error(apiErrorMessage(error, fallback));
  }
}

type PageInfo = { page: number; limit: number; total: number; totalPages?: number; pages?: number };
/** The backend uses `{ data, pagination }` in most modules and `{ items, pagination }` for employees. */
type Paged<T> = { data?: T[]; items?: T[]; pagination: PageInfo };

/** Fetches every page of a paginated list endpoint (limit 100, capped to protect the device). */
export async function fetchAll<T>(load: (page: number) => Promise<Paged<T>>, maxPages = 20): Promise<T[]> {
  const results: T[] = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const response = await load(page);
    const rows = response.data ?? response.items ?? [];
    results.push(...rows);
    const totalPages = response.pagination.totalPages ?? response.pagination.pages ?? 1;
    if (page >= totalPages || rows.length === 0) break;
  }
  return results;
}

export const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
