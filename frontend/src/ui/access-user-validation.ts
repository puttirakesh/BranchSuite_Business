import type { AccessRole, AccessUser } from '../core/admin/organisation';

export type AccessUserErrors = Partial<Record<'name' | 'email' | 'role' | 'branches', string>>;

export function validateAccessUser(
  draft: AccessUser,
  users: Pick<AccessUser, 'id' | 'email'>[],
  assignableRoles: readonly AccessRole[],
  availableBranchIds: readonly string[],
): AccessUserErrors {
  const errors: AccessUserErrors = {};
  const name = draft.name.trim();
  const email = draft.email.trim().toLowerCase();
  if (!name) errors.name = 'Enter the user’s full name.';
  else if (name.length > 150) errors.name = 'Use 150 characters or fewer.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) errors.email = 'Enter a valid work email address.';
  else if (users.some(user => user.id !== draft.id && user.email.trim().toLowerCase() === email)) errors.email = 'A user with this email already exists.';
  if (!assignableRoles.includes(draft.role)) errors.role = 'Choose an available role.';
  if (!draft.id && !draft.branches.length) errors.branches = 'Select at least one branch.';
  else if (!draft.id && draft.branches.some(id => !availableBranchIds.includes(id))) errors.branches = 'Choose an available branch.';
  return errors;
}
