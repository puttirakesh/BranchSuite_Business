/** Branch IDs are authoritative; names only support older display records. */
export function isInBranch(record: { branchId?: string | null; branch?: string }, branchId: string | null | undefined, branchName = '') {
  if (!branchId) return true;
  return record.branchId !== undefined ? record.branchId === branchId : !!branchName && record.branch === branchName;
}
