export type AdvanceStatusFilter = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

/** "Branch name · N requests" subtitle. Singular for exactly one; falls back to "All branches". */
export function advanceRequestsSubtitle(branchName: string | null | undefined, count: number): string {
  const name = (branchName ?? '').trim() || 'All branches';
  const safe = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  return `${name} · ${safe} ${safe === 1 ? 'request' : 'requests'}`;
}

export function filterAdvancesByStatus<T extends { status: string }>(advances: T[], filter: AdvanceStatusFilter | string): T[] {
  return filter === 'ALL' ? advances : advances.filter(advance => advance.status === filter);
}

/** "PENDING" -> "Pending" for display. */
export function formatAdvanceStatus(status: string): string {
  const lower = status.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}
