import type { BranchDto } from './api';

export type BranchDraft = {
  id: string; name: string; code: string; location: string; manager: string;
  latitude: number | null; longitude: number | null;
  managerUserId?: string | null; managerUserName?: string;
  shiftStart: string; shiftEnd: string; graceMinutes: string;
  employees: number; active: boolean;
};
export const SHIFT_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
export const emptyBranch: BranchDraft = {
  id: '', name: '', code: '', location: '', manager: '', managerUserId: null,
  latitude: null, longitude: null,
  shiftStart: '', shiftEnd: '', graceMinutes: '0', employees: 0, active: true,
};
export function branchDraft(item: BranchDto): BranchDraft {
  return {
    id: item.id, name: item.name, code: item.code, location: item.location, manager: item.manager,
    latitude: item.latitude ?? null, longitude: item.longitude ?? null,
    managerUserId: item.managerUserId ?? null, managerUserName: item.managerUser?.name,
    shiftStart: item.shiftStart ?? '', shiftEnd: item.shiftEnd ?? '',
    graceMinutes: String(item.graceMinutes ?? 0), employees: item.employees, active: item.status === 'ACTIVE',
  };
}

/** Preserve the existing branch API validation when moving the form out of its modal. */
export function branchFormValues(draft: BranchDraft, branches: BranchDraft[]) {
  const name = draft.name.trim(), location = draft.location.trim();
  if (!name) throw new Error('Enter a branch name.');
  if (name.length > 150 || location.length > 240) throw new Error('Branch name or location exceeds the allowed length.');
  const shiftStart = draft.shiftStart.trim(), shiftEnd = draft.shiftEnd.trim();
  const graceMinutes = Number(draft.graceMinutes.trim() || 0);
  if ((shiftStart && !SHIFT_TIME.test(shiftStart)) || (shiftEnd && !SHIFT_TIME.test(shiftEnd)) || (shiftEnd && !shiftStart)) throw new Error('Enter shift times as HH:mm (24-hour), with a start time before setting an end time.');
  if (shiftStart && shiftStart === shiftEnd) throw new Error('Shift start and end cannot be the same time.');
  if (!Number.isInteger(graceMinutes) || graceMinutes < 0 || graceMinutes > 180) throw new Error('Grace period must be a whole number of minutes from 0 to 180.');
  if (branches.some(item => item.id !== draft.id && item.name.toLowerCase() === name.toLowerCase())) throw new Error('A branch with that name already exists in this company.');
  if ((draft.latitude !== null || draft.longitude !== null) && (typeof draft.latitude !== 'number' || typeof draft.longitude !== 'number' || !Number.isFinite(draft.latitude) || !Number.isFinite(draft.longitude) || Math.abs(draft.latitude) > 90 || Math.abs(draft.longitude) > 180)) throw new Error('Choose a valid branch location on the map.');
  return { name, location, latitude: draft.latitude, longitude: draft.longitude, managerUserId: draft.managerUserId, shiftStart: shiftStart || null, shiftEnd: shiftEnd || null, graceMinutes };
}
