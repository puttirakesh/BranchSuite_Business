/** Pagination envelope used by every list endpoint of the shared backend. */
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ListQuery {
  search?: string;
  status?: string;
  stage?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export function pageOf<T>(items: T[], query: ListQuery = {}): Page<T> {
  const limit = query.limit ?? 50;
  const page = query.page ?? 1;
  const start = (page - 1) * limit;
  return {
    items: items.slice(start, start + limit),
    total: items.length,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(items.length / limit)),
  };
}

export function matches(search: string | undefined, ...values: (string | number | null | undefined)[]) {
  const q = (search ?? '').trim().toLowerCase();
  if (!q) return true;
  return values.join(' ').toLowerCase().includes(q);
}
