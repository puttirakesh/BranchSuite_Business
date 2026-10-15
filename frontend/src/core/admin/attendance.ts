import {
  attendanceApi,
  leaveApi,
  type AttendanceDto,
  type AttendanceStatus,
  type LeaveRequestDto,
} from './api';

import {
  getAdminScope,
  getCompanyBranches,
  branchNameMap,
  resolveBranchId,
} from './scope';

import {
  dateOnly,
  extrasKeys,
  timeLabel,
} from './local';

import { getEmployees } from '../employees';
import AsyncStorage from '@react-native-async-storage/async-storage';

// =====================================================
// ATTENDANCE TYPES
// =====================================================

export type Shift = {
  id: string;
  employeeId: string;
  date: string;
  checkIn: string;
  checkOut: string;
  branch?: string;
  branchId?: string;
  shiftName?: string;
  needsReview?: boolean;
  status?: AttendanceStatus;
};

// =====================================================
// UTC DATE HELPERS
// =====================================================

const utcToday = (): string =>
  new Date().toISOString().slice(0, 10);

const utcDaysAgo = (days: number): string => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
};

// =====================================================
// MAP ATTENDANCE TO SHIFT
// =====================================================

function toShift(
  dto: AttendanceDto,
  branchNames: Map<string, string>,
  today: string
): Shift {
  const attendanceDate = dateOnly(dto.attendanceDate);

  const missingPastCheckout =
    dto.status === 'PRESENT' &&
    Boolean(dto.checkInAt) &&
    !dto.checkOutAt &&
    attendanceDate < today;

  return {
    id: dto.id,
    employeeId: dto.userId,
    date: attendanceDate,
    checkIn: timeLabel(dto.checkInAt),
    checkOut: timeLabel(dto.checkOutAt),
    branch: branchNames.get(dto.branchId),
    branchId: dto.branchId,
    status: dto.status,
    needsReview:
      dto.status === 'HALF_DAY' ||
      missingPastCheckout,
  };
}

// =====================================================
// READ TEAM ATTENDANCE
// =====================================================

export async function readTeamAttendance(): Promise<Shift[]> {
  const scope = await getAdminScope();
  const today = utcToday();

  const [records, branches] = await Promise.all([
    attendanceApi.list({
      companyId: scope.companyId,
      fromDate: utcDaysAgo(62),
      toDate: today,
    }),
    getCompanyBranches(),
  ]);

  const names = branchNameMap(branches);

  return records.map(record =>
    toShift(record, names, today)
  );
}

// =====================================================
// READ MY ATTENDANCE
// =====================================================

export async function readMyAttendance(): Promise<Shift[]> {
  const today = utcToday();

  const [records, branches] = await Promise.all([
    attendanceApi.mine({
      fromDate: utcDaysAgo(120),
      toDate: today,
    }),
    getCompanyBranches(),
  ]);

  const names = branchNameMap(branches);

  return records.map(record =>
    toShift(record, names, today)
  );
}

// =====================================================
// RESOLVE MY BRANCH
// =====================================================

async function myBranchId(
  branchName?: string
): Promise<string> {
  const scope = await getAdminScope();

  if (branchName?.trim()) {
    const requested = resolveBranchId(
      scope.branches,
      branchName
    );

    if (!requested) {
      throw new Error(
        'The requested branch is not available in your account.'
      );
    }

    return requested;
  }

  const fallback = scope.branches[0]?.id;

  if (!fallback) {
    throw new Error(
      'You are not assigned to a branch.'
    );
  }

  return fallback;
}

// =====================================================
// SELF CHECK-IN
// =====================================================

export async function checkIn(
  branchName?: string
) {
  const scope = await getAdminScope();
  const branchId = await myBranchId(branchName);

  return attendanceApi.checkIn(
    scope.companyId,
    branchId
  );
}

// =====================================================
// SELF CHECK-OUT
// =====================================================

export async function checkOut(
  branchName?: string
) {
  const scope = await getAdminScope();
  const branchId = await myBranchId(branchName);

  return attendanceApi.checkOut(
    scope.companyId,
    branchId
  );
}

// =====================================================
// MANUAL ATTENDANCE
// =====================================================

export async function markAttendance(input: {
  employeeId: string;
  branchName?: string;
  date: string;
  status: AttendanceStatus;
  notes?: string;
}) {
  if (!input.employeeId.trim()) {
    throw new Error(
      'Select an employee before marking attendance.'
    );
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    throw new Error(
      'Attendance date must be YYYY-MM-DD.'
    );
  }

  const date = new Date(
    `${input.date}T00:00:00.000Z`
  );

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== input.date
  ) {
    throw new Error(
      'Enter a valid attendance date.'
    );
  }

  if (input.date > utcToday()) {
    throw new Error(
      'Cannot mark attendance for a future UTC date.'
    );
  }

  const scope = await getAdminScope();
  const branches = await getCompanyBranches();

  const branchId = resolveBranchId(
    branches,
    input.branchName
  );

  if (!branchId) {
    throw new Error(
      'This employee’s branch could not be found.'
    );
  }

  return attendanceApi.mark({
    companyId: scope.companyId,
    branchId,
    userId: input.employeeId,
    attendanceDate: input.date,
    status: input.status,
    ...(input.notes?.trim()
      ? { notes: input.notes.trim() }
      : {}),
  });
}

// =====================================================
// LEAVE AND CORRECTION REQUEST TYPES
// =====================================================

export type AdminRequest = {
  id: string;
  type: 'leave' | 'correction';
  startDate: string;
  endDate: string;
  reason: string;
  status:
    | 'pending'
    | 'approved'
    | 'rejected'
    | 'cancelled';
  createdAt: string;
  reviewedAt?: string;
  employeeId?: string;
  employeeName?: string;
  branch?: string;
  leaveType?: string;
  correctCheckIn?: string;
  correctCheckOut?: string;
  shiftId?: string;
};

const statusFromApi = (
  status: LeaveRequestDto['status']
): AdminRequest['status'] =>
  status.toLowerCase() as AdminRequest['status'];

// =====================================================
// LOCAL ATTENDANCE CORRECTIONS
// =====================================================

async function readCorrections(): Promise<AdminRequest[]> {
  try {
    const stored = await AsyncStorage.getItem(
      extrasKeys.corrections
    );

    const parsed: unknown = JSON.parse(
      stored || '[]'
    );

    return Array.isArray(parsed)
      ? parsed as AdminRequest[]
      : [];
  } catch {
    return [];
  }
}

// =====================================================
// READ LEAVE AND CORRECTION REQUESTS
// =====================================================

export async function readRequests(): Promise<AdminRequest[]> {
  const scope = await getAdminScope();

  const [
    leave,
    branches,
    employees,
    corrections,
  ] = await Promise.all([
    leaveApi.requests(scope.companyId),
    getCompanyBranches(),
    getEmployees().catch(() => []),
    readCorrections(),
  ]);

  const branchNames = branchNameMap(branches);

  const names = new Map(
    employees.map(employee => [
      employee.id,
      employee.fullName,
    ])
  );

  const mapped: AdminRequest[] = leave.map(dto => {
    const mine = dto.userId === scope.user.id;

    return {
      id: dto.id,
      type: 'leave',
      startDate: dateOnly(dto.startDate),
      endDate: dateOnly(dto.endDate),
      reason: dto.reason,
      status: statusFromApi(dto.status),
      createdAt: dto.createdAt,

      ...(dto.reviewedAt
        ? { reviewedAt: dto.reviewedAt }
        : {}),

      ...(mine
        ? {}
        : { employeeId: dto.userId }),

      employeeName: mine
        ? scope.user.name
        : names.get(dto.userId) ?? 'Team member',

      branch: branchNames.get(dto.branchId),
      leaveType: dto.leaveType?.name,
    };
  });

  return [...mapped, ...corrections].sort(
    (a, b) =>
      b.createdAt.localeCompare(a.createdAt)
  );
}

// =====================================================
// FIND OR CREATE LEAVE TYPE
// =====================================================

async function leaveTypeId(
  name: string
): Promise<string> {
  const scope = await getAdminScope();

  const types = await leaveApi.types(
    scope.companyId
  );

  const wanted = name.trim().toLowerCase();

  if (!wanted) {
    throw new Error(
      'Leave type is required.'
    );
  }

  const existing = types.find(
    type =>
      type.name.toLowerCase() === wanted &&
      type.status === 'ACTIVE'
  );

  if (existing) {
    return existing.id;
  }

  const code =
    name
      .trim()
      .split(/\s+/)
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '') || 'LV';

  const uniqueCode = types.some(
    type => type.code === code
  )
    ? `${code}${Date.now()
        .toString(36)
        .toUpperCase()
        .slice(-4)}`
    : code;

  const created = await leaveApi.createType({
    companyId: scope.companyId,
    code: uniqueCode,
    name: name.trim(),
    isPaid: true,
  });

  return created.id;
}

// =====================================================
// SAVE LEAVE AND CORRECTION REQUESTS
// =====================================================

export async function saveRequests(
  next: AdminRequest[]
): Promise<void> {
  const scope = await getAdminScope();

  const current = await readRequests();

  const byId = new Map(
    current.map(request => [
      request.id,
      request,
    ])
  );

  // Correction requests remain device-local
  // until the backend correction API exists.
  await AsyncStorage.setItem(
    extrasKeys.corrections,
    JSON.stringify(
      next.filter(
        request => request.type === 'correction'
      )
    )
  );

  for (const request of next) {
    if (request.type !== 'leave') {
      continue;
    }

    const before = byId.get(request.id);

    if (!before) {
      await leaveApi.apply({
        companyId: scope.companyId,
        branchId: await myBranchId(
          request.branch
        ),
        leaveTypeId: await leaveTypeId(
          request.leaveType || 'Casual leave'
        ),
        startDate: request.startDate,
        endDate: request.endDate,
        reason: request.reason,
      });

      continue;
    }

    if (before.status === request.status) {
      continue;
    }

    if (before.status !== 'pending') {
      throw new Error(
        'This request has already been reviewed.'
      );
    }

    if (request.status === 'approved') {
      await leaveApi.approve(request.id);
    } else if (request.status === 'rejected') {
      await leaveApi.reject(request.id);
    } else if (request.status === 'cancelled') {
      await leaveApi.cancel(request.id);
    }
  }
}
