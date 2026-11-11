import axios from 'axios';

/**
 * Turns a backend / network failure into a sentence the admin pages can show.
 * NestJS errors look like { statusCode, message: string | string[], error }.
 */
export function apiErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const response = typeof error === 'object' && error !== null && 'response' in error
    ? (error as { response?: { status?: number; data?: { message?: unknown; code?: unknown } } }).response : undefined;
  if (response) {
    if (response.status === 401) return 'Your session has expired. Please sign in again.';
    if (response.status === 403) {
      // The server's plan-limit message is specific and actionable ("Your plan allows up to 2 branches...").
      if (response.data?.code === 'PLAN_LIMIT_REACHED' && typeof response.data.message === 'string' && response.data.message.trim()) {
        return response.data.message.trim();
      }
      if (typeof response.data?.message === 'string' && /active paid subscription/i.test(response.data.message)) {
        return 'Your subscription is not active. Complete payment to continue.';
      }
      return 'You do not have permission to do this.';
    }
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
  if (maxPages < 1) return [];

  const firstPage = await load(1);
  const results = [...(firstPage.data ?? firstPage.items ?? [])];
  const totalPages = Math.min(
    maxPages,
    Math.max(1, firstPage.pagination.totalPages ?? firstPage.pagination.pages ?? 1),
  );
  const pageConcurrency = 4;

  for (let start = 2; start <= totalPages; start += pageConcurrency) {
    const pages = Array.from(
      { length: Math.min(pageConcurrency, totalPages - start + 1) },
      (_, index) => start + index,
    );
    const responses = await Promise.all(pages.map(page => load(page)));
    for (const response of responses) {
      results.push(...(response.data ?? response.items ?? []));
    }
  }

  return results;
}

export const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
