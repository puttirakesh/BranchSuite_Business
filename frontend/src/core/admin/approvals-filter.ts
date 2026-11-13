export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type ApprovalType = 'leave' | 'correction';
/** Status dropdown values use the backend enum names; ALL means no status filter. */
export type ApprovalStatusFilter = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export type ApprovalFilterable = {
  type: ApprovalType;
  status: ApprovalStatus;
  branch?: string;
  employeeName?: string;
  leaveType?: string;
  reason?: string;
};

export type ApprovalFilters = {
  search?: string;
  status?: ApprovalStatusFilter | string;
  type?: ApprovalType | '';
  branch?: string;
};

export function approvalTypeLabel(request: Pick<ApprovalFilterable, 'type' | 'leaveType'>): string {
  return request.type === 'leave' ? request.leaveType || 'Leave request' : 'Attendance correction';
}

/** Branch-only scope (used for banner counts: everything pending in the permitted/selected branch). */
export function scopeByBranch<T extends ApprovalFilterable>(requests: T[], branch: string): T[] {
  return requests.filter(request => !branch || (request.branch || 'Unknown branch') === branch);
}

export function pendingCounts(scoped: ApprovalFilterable[]): { leave: number; correction: number } {
  return {
    leave: scoped.filter(request => request.type === 'leave' && request.status === 'pending').length,
    correction: scoped.filter(request => request.type === 'correction' && request.status === 'pending').length,
  };
}

/** Combined predicate: branch AND status AND type AND text search (name, type, branch, reason). */
export function filterApprovals<T extends ApprovalFilterable>(requests: T[], filters: ApprovalFilters): T[] {
  const query = (filters.search ?? '').trim().toLowerCase();
  const status = (filters.status ?? 'ALL').toString().toLowerCase();
  return scopeByBranch(requests, filters.branch ?? '').filter(request =>
    (status === 'all' || request.status === status)
    && (!filters.type || request.type === filters.type)
    && [request.employeeName || 'Team member', approvalTypeLabel(request), request.branch || 'Unknown branch', request.reason ?? '']
      .some(value => value.toLowerCase().includes(query)));
}
