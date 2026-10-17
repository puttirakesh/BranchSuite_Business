import axios from 'axios';

/**
 * Turns a backend / network failure into a sentence the admin pages can show.
 * NestJS errors look like { statusCode, message: string | string[], error }.
 */
export function apiErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) return 'Cannot reach the server. Check your connection and try again.';
    const message = (error.response.data as { message?: unknown } | undefined)?.message;
    if (Array.isArray(message)) return message.join(' ');
    if (typeof message === 'string' && message.trim()) return message;
    if (error.response.status === 401) return 'Your session has expired. Please sign in again.';
    if (error.response.status === 403) return 'You do not have permission to do this.';
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
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
