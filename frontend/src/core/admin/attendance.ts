/**
 * Attendance and leave for the admin pages.
 *
 * Shift            ⇄ /attendance records (check-in/out times, branch)
 * Request "leave"  ⇄ /leave/requests (apply, approve, reject, cancel)
 * Request "correction" — attendance corrections have no backend endpoint; kept on this device.
 */
import { attendanceApi, leaveApi, type AttendanceDto, type AttendanceStatus, type LeaveRequestDto } from './api';
import { getAdminScope, getCompanyBranches, branchNameMap, resolveBranchId } from './scope';
import { dateOnly, extrasKeys, localIsoDate, timeLabel } from './local';
import { getEmployees } from '../employees';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Shift = {
  id: string; employeeId: string; date: string; checkIn: string; checkOut: string;
  branch?: string; shiftName?: string; needsReview?: boolean; status?: AttendanceStatus;
};

function toShift(dto: AttendanceDto, branchNames: Map<string, string>, today: string): Shift {
  return {
    id: dto.id,
    employeeId: dto.userId,
    date: dateOnly(dto.attendanceDate),
    checkIn: timeLabel(dto.checkInAt),
    checkOut: timeLabel(dto.checkOutAt),
    branch: branchNames.get(dto.branchId),
    status: dto.status,
    // Needs review: half days, and past days that were checked in but never checked out.
    needsReview: dto.status === 'HALF_DAY' || (dto.status === 'PRESENT' && !!dto.checkInAt && !dto.checkOutAt && dateOnly(dto.attendanceDate) < today),
  };
}

const daysAgo = (days: number) => { const date = new Date(); date.setDate(date.getDate() - days); return localIsoDate(date); };

/** Team attendance for the last ~2 months (enough for the team view, payroll checks and reports). */
export async function readTeamAttendance(): Promise<Shift[]> {
  const scope = await getAdminScope();
  const [records, branches] = await Promise.all([
    attendanceApi.list({ companyId: scope.companyId, fromDate: daysAgo(62), toDate: localIsoDate() }),
    getCompanyBranches(),
  ]);
  const names = branchNameMap(branches);
  return records.map(record => toShift(record, names, localIsoDate()));
}

/** The signed-in admin's own attendance history. */
export async function readMyAttendance(): Promise<Shift[]> {
  const [records, branches] = await Promise.all([attendanceApi.mine({ fromDate: daysAgo(120) }), getCompanyBranches()]);
  const names = branchNameMap(branches);
  return records.map(record => toShift(record, names, localIsoDate()));
}

async function myBranchId(branchName?: string): Promise<string> {
  const scope = await getAdminScope();
  const branchId = resolveBranchId(scope.branches, branchName) ?? scope.branches[0]?.id;
  if (!branchId) throw new Error('You are not assigned to a branch.');
  return branchId;
}

export async function checkIn(branchName?: string) {
  const scope = await getAdminScope();
  return attendanceApi.checkIn(scope.companyId, await myBranchId(branchName));
}

export async function checkOut(branchName?: string) {
  const scope = await getAdminScope();
  return attendanceApi.checkOut(scope.companyId, await myBranchId(branchName));
}

/** Manual marking by an admin/manager (backend never overwrites an existing record). */
export async function markAttendance(input: { employeeId: string; branchName?: string; date: string; status: AttendanceStatus; notes?: string }) {
  const scope = await getAdminScope();
  const branches = await getCompanyBranches();
  const branchId = resolveBranchId(branches, input.branchName);
  if (!branchId) throw new Error('This employee’s branch could not be found.');
  return attendanceApi.mark({ companyId: scope.companyId, branchId, userId: input.employeeId, attendanceDate: input.date, status: input.status, notes: input.notes });
}

// ---------------------------------------------------------------- leave & correction requests
export type AdminRequest = {
  id: string; type: 'leave' | 'correction'; startDate: string; endDate: string; reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'; createdAt: string; reviewedAt?: string;
  /** Undefined for the signed-in admin's own requests (the pages treat those as "personal"). */
  employeeId?: string; employeeName?: string; branch?: string; leaveType?: string;
  correctCheckIn?: string; correctCheckOut?: string; shiftId?: string;
};

const statusFromApi = (status: LeaveRequestDto['status']) => status.toLowerCase() as AdminRequest['status'];

async function readCorrections(): Promise<AdminRequest[]> {
  try {
    const parsed: unknown = JSON.parse(await AsyncStorage.getItem(extrasKeys.corrections) || '[]');
    return Array.isArray(parsed) ? parsed as AdminRequest[] : [];
  } catch { return []; }
}

export async function readRequests(): Promise<AdminRequest[]> {
  const scope = await getAdminScope();
  const [leave, branches, employees, corrections] = await Promise.all([
    leaveApi.requests(scope.companyId), getCompanyBranches(), getEmployees().catch(() => []), readCorrections(),
  ]);
  const branchNames = branchNameMap(branches);
  const names = new Map(employees.map(employee => [employee.id, employee.fullName]));
  const mapped = leave.map(dto => {
    const mine = dto.userId === scope.user.id;
    const request: AdminRequest = {
      id: dto.id, type: 'leave',
      startDate: dateOnly(dto.startDate), endDate: dateOnly(dto.endDate),
      reason: dto.reason, status: statusFromApi(dto.status), createdAt: dto.createdAt,
      ...(dto.reviewedAt ? { reviewedAt: dto.reviewedAt } : {}),
      ...(mine ? {} : { employeeId: dto.userId }),
      employeeName: mine ? scope.user.name : names.get(dto.userId) ?? 'Team member',
      branch: branchNames.get(dto.branchId),
      leaveType: dto.leaveType?.name,
    };
    return request;
  });
  return [...mapped, ...corrections].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Finds a leave type by name, creating it for the company on first use (e.g. "Casual leave"). */
async function leaveTypeId(name: string): Promise<string> {
  const scope = await getAdminScope();
  const types = await leaveApi.types(scope.companyId);
  const wanted = name.trim().toLowerCase();
  const match = types.find(type => type.name.toLowerCase() === wanted && type.status === 'ACTIVE');
  if (match) return match.id;
  const code = name.trim().split(/\s+/).map(part => part[0]).join('').toUpperCase().replace(/[^A-Z0-9]/g, '') || 'LV';
  const created = await leaveApi.createType({ companyId: scope.companyId, code: types.some(type => type.code === code) ? `${code}${Date.now().toString(36).toUpperCase().slice(-4)}` : code, name: name.trim(), isPaid: true });
  return created.id;
}

export async function saveRequests(next: AdminRequest[]): Promise<void> {
  const scope = await getAdminScope();
  const current = await readRequests();
  const byId = new Map(current.map(request => [request.id, request]));

  await AsyncStorage.setItem(extrasKeys.corrections, JSON.stringify(next.filter(request => request.type === 'correction')));

  for (const request of next) {
    if (request.type !== 'leave') continue;
    const before = byId.get(request.id);
    if (!before) {
      await leaveApi.apply({
        companyId: scope.companyId,
        branchId: await myBranchId(request.branch),
        leaveTypeId: await leaveTypeId(request.leaveType || 'Casual leave'),
        startDate: request.startDate, endDate: request.endDate, reason: request.reason,
      });
    } else if (before.status !== request.status) {
      if (before.status !== 'pending') throw new Error('This request has already been reviewed.');
      if (request.status === 'approved') await leaveApi.approve(request.id);
      else if (request.status === 'rejected') await leaveApi.reject(request.id);
      else if (request.status === 'cancelled') await leaveApi.cancel(request.id);
    }
  }
}
