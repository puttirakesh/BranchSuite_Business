
import { api } from '../api/client';
import { call } from './http';

import {
  attendanceApi,
  attendanceCorrectionsApi,
  leaveApi,
  type AttendanceDto,
  type AttendanceStatus,
  type LeaveRequestDto,
} from './api';

import {
  getAdminScope,
  getBranchDirectory,
  branchNameMap,
  resolveBranchId,
} from './scope';

import {
  dateOnly,
  timeLabel,
} from './local';

import { getEmployees } from '../employees';

// ======================================================
// TYPES
// ======================================================

export type Shift = {
  id: string;
  employeeId: string; // Backend User.id
  date: string;
  checkIn: string;
  checkOut: string;
  branch?: string;
  branchId?: string;
  companyId?: string;
  shiftName?: string;
  needsReview?: boolean;
  status?: AttendanceStatus;
  lateMinutes?: number;
};

export type CorrectionStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED';

export type CorrectionRequest = {
  id: string;
  attendanceId: string;
  userId: string;
  companyId: string;
  branchId: string;
  employeeName: string;
  branchName: string;
  attendanceDate: string;
  requestedCheckInAt: string;
  requestedCheckOutAt: string;
  reason: string;
  status: CorrectionStatus;
  createdAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
};

type CorrectionDto = {
  id: string;
  attendanceId: string;
  userId: string;
  companyId: string;
  branchId: string;
  requestedCheckInAt: string;
  requestedCheckOutAt: string;
  reason: string;
  status: CorrectionStatus;
  createdAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
  requestedBy?: {
    id: string;
    name: string;
    email: string;
  };
  attendance?: {
    attendanceDate: string;
    checkInAt: string | null;
    checkOutAt: string | null;
    status: AttendanceStatus;
  };
};

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
  reviewNote?: string;
};

// ======================================================
// DATE HELPERS
// ======================================================

export const utcToday = (): string =>
  new Date().toISOString().slice(0, 10);

export const utcDaysAgo = (days: number): string => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
};

export function validAttendanceDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

export function shiftAttendanceDate(
  current: string,
  days: number,
): string {
  if (!validAttendanceDate(current)) {
    throw new Error('Invalid attendance date.');
  }

  const date = new Date(`${current}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Attendance operation failed.';
}

// ======================================================
// ATTENDANCE MAPPING
// ======================================================

function toShift(
  dto: AttendanceDto,
  names: Map<string, string>,
  today: string,
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
    companyId: dto.companyId,
    branchId: dto.branchId,
    branch: names.get(dto.branchId) ?? 'Unknown branch',
    status: dto.status,
    lateMinutes: dto.lateMinutes ?? 0,
    needsReview:
      dto.status === 'HALF_DAY' ||
      missingPastCheckout,
  };
}

// ======================================================
// READ TEAM ATTENDANCE
// ======================================================

export async function readTeamAttendance(
  options: {
    date?: string;
    fromDate?: string;
    toDate?: string;
    branchId?: string;
  } = {},
): Promise<Shift[]> {
  const scope = await getAdminScope();

  const fromDate =
    options.date ?? options.fromDate ?? utcDaysAgo(62);

  const toDate =
    options.date ?? options.toDate ?? utcToday();

  if (
    !validAttendanceDate(fromDate) ||
    !validAttendanceDate(toDate) ||
    fromDate > toDate
  ) {
    throw new Error('Invalid attendance date range.');
  }

  if (
    options.branchId &&
    !scope.branches.some(
      (branch) => branch.id === options.branchId,
    )
  ) {
    throw new Error(
      'Selected branch is not available in your workspace.',
    );
  }

  const [records, branches] = await Promise.all([
    attendanceApi.list({
      companyId: scope.companyId,
      ...(options.branchId
        ? { branchId: options.branchId }
        : {}),
      fromDate,
      toDate,
    }),
    getBranchDirectory(),
  ]);

  const names = branchNameMap(branches);
  const allowed = new Set(
    scope.branches.map((branch) => branch.id),
  );

  return records
    .filter(
      (record) =>
        record.companyId === scope.companyId &&
        allowed.has(record.branchId),
    )
    .map((record) =>
      toShift(record, names, utcToday()),
    );
}

// ======================================================
// READ PERSONAL ATTENDANCE
// ======================================================

export async function readMyAttendance(): Promise<Shift[]> {
  const scope = await getAdminScope();

  const [records, branches] = await Promise.all([
    attendanceApi.mine({
      fromDate: utcDaysAgo(120),
      toDate: utcToday(),
    }),
    getBranchDirectory(),
  ]);

  const names = branchNameMap(branches);
  const allowed = new Set(
    scope.branches.map((branch) => branch.id),
  );

  return records
    .filter(
      (record) =>
        record.companyId === scope.companyId &&
        allowed.has(record.branchId),
    )
    .map((record) =>
      toShift(record, names, utcToday()),
    );
}

// ======================================================
// RESOLVE PERSONAL BRANCH
// ======================================================

async function myBranchId(
  branchName?: string,
): Promise<string> {
  const scope = await getAdminScope();

  if (branchName?.trim()) {
    const requested = resolveBranchId(
      scope.branches,
      branchName,
    );

    if (!requested) {
      throw new Error(
        'Requested branch is not assigned to your account.',
      );
    }

    return requested;
  }

  if (scope.branches.length !== 1) {
    throw new Error(
      'Select a specific branch before recording attendance.',
    );
  }

  return scope.branches[0].id;
}

// ======================================================
// SELF CHECK-IN / CHECK-OUT
// ======================================================

export async function checkIn(
  branchName?: string,
) {
  const scope = await getAdminScope();
  const branchId = await myBranchId(branchName);

  return attendanceApi.checkIn(
    scope.companyId,
    branchId,
  );
}

export async function checkOut(
  branchName?: string,
) {
  const scope = await getAdminScope();
  const branchId = await myBranchId(branchName);

  return attendanceApi.checkOut(
    scope.companyId,
    branchId,
  );
}

// ======================================================
// MANUAL ATTENDANCE
// ======================================================

export async function markAttendance(input: {
  employeeId: string;
  branchId?: string;
  branchName?: string;
  date: string;
  status: AttendanceStatus;
  notes?: string;
}) {
  if (!input.employeeId.trim()) {
    throw new Error('Employee user ID is required.');
  }

  if (!validAttendanceDate(input.date)) {
    throw new Error('Invalid attendance date.');
  }

  if (input.date > utcToday()) {
    throw new Error(
      'Cannot mark attendance for a future UTC date.',
    );
  }

  const scope = await getAdminScope();

  const branchId = input.branchId ??
    resolveBranchId(scope.branches, input.branchName);

  if (!branchId) {
    throw new Error(
      'A specific branch must be selected.',
    );
  }

  if (
    !scope.branches.some(
      (branch) => branch.id === branchId,
    )
  ) {
    throw new Error(
      'This branch is not available in your workspace.',
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

// ======================================================
// CORRECTION MAPPING
// ======================================================

function mapCorrection(
  dto: CorrectionDto,
  names: Map<string, string>,
): CorrectionRequest {
  return {
    id: dto.id,
    attendanceId: dto.attendanceId,
    userId: dto.userId,
    companyId: dto.companyId,
    branchId: dto.branchId,
    employeeName:
      dto.requestedBy?.name ?? 'Team member',
    branchName:
      names.get(dto.branchId) ?? 'Unknown branch',
    attendanceDate: dateOnly(
      dto.attendance?.attendanceDate ??
        dto.requestedCheckInAt,
    ),
    requestedCheckInAt: dto.requestedCheckInAt,
    requestedCheckOutAt: dto.requestedCheckOutAt,
    reason: dto.reason,
    status: dto.status,
    createdAt: dto.createdAt,
    reviewedAt: dto.reviewedAt ?? null,
    reviewNote: dto.reviewNote ?? null,
  };
}

// ======================================================
// READ TEAM CORRECTION REQUESTS
// ======================================================

export async function readCorrectionRequests(
  branchId?: string,
): Promise<CorrectionRequest[]> {
  const scope = await getAdminScope();

  if (
    branchId &&
    !scope.branches.some(
      (branch) => branch.id === branchId,
    )
  ) {
    throw new Error('Branch access denied.');
  }

  const [records, branches] = await Promise.all([
    attendanceCorrectionsApi.list({
      companyId: scope.companyId,
      ...(branchId ? { branchId } : {}),
    }),
    getBranchDirectory(),
  ]);

  const names = branchNameMap(branches);
  const allowed = new Set(
    scope.branches.map((branch) => branch.id),
  );

  return (records as CorrectionDto[])
    .filter(
      (record) =>
        record.companyId === scope.companyId &&
        allowed.has(record.branchId),
    )
    .map((record) => mapCorrection(record, names))
    .sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
}

// ======================================================
// READ PERSONAL CORRECTIONS
// ======================================================

export async function readMyCorrections():
  Promise<CorrectionRequest[]> {
  const scope = await getAdminScope();

  const [records, branches] = await Promise.all([
    call(
      api.get<CorrectionDto[]>(
        '/attendance/corrections/my',
      ),
    ),
    getBranchDirectory(),
  ]);

  const names = branchNameMap(branches);

  return records
    .filter(
      (record) =>
        record.companyId === scope.companyId &&
        record.userId === scope.user.id,
    )
    .map((record) => mapCorrection(record, names))
    .sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
}

// ======================================================
// SUBMIT CORRECTION
// ======================================================

export async function submitAttendanceCorrection(
  input: {
    attendanceId: string;
    requestedCheckInAt: string;
    requestedCheckOutAt: string;
    reason: string;
  },
): Promise<CorrectionRequest> {
  const scope = await getAdminScope();

  const reason = input.reason.trim();

  if (!input.attendanceId.trim()) {
    throw new Error('Select an attendance record.');
  }

  if (!reason) {
    throw new Error('Correction reason is required.');
  }

  const checkIn = new Date(input.requestedCheckInAt);
  const checkOut = new Date(input.requestedCheckOutAt);

  if (
    Number.isNaN(checkIn.getTime()) ||
    Number.isNaN(checkOut.getTime()) ||
    checkOut <= checkIn
  ) {
    throw new Error('Invalid correction times.');
  }

  const dto = await call(
    api.post<CorrectionDto>(
      '/attendance/corrections',
      {
        attendanceId: input.attendanceId,
        requestedCheckInAt: checkIn.toISOString(),
        requestedCheckOutAt: checkOut.toISOString(),
        reason,
      },
    ),
  );

  const branches = await getBranchDirectory();

  if (
    dto.companyId !== scope.companyId ||
    dto.userId !== scope.user.id
  ) {
    throw new Error(
      'Correction was saved but belongs to a different workspace. Refresh your session.',
    );
  }

  return mapCorrection(dto, branchNameMap(branches));
}

// ======================================================
// REVIEW CORRECTIONS
// ======================================================

export async function approveCorrection(
  id: string,
  note?: string,
) {
  return call(
    api.patch<CorrectionDto>(
      `/attendance/corrections/${id}/approve`,
      { note: note?.trim() || undefined },
    ),
  );
}

export async function rejectCorrection(
  id: string,
  reason: string,
) {
  if (!reason.trim()) {
    throw new Error('A rejection reason is required.');
  }

  return call(
    api.patch<CorrectionDto>(
      `/attendance/corrections/${id}/reject`,
      { note: reason.trim() },
    ),
  );
}

export async function cancelCorrection(
  id: string,
) {
  return call(
    api.patch<CorrectionDto>(
      `/attendance/corrections/${id}/cancel`,
      {},
    ),
  );
}

// ======================================================
// COMBINED LEAVE AND CORRECTION REQUESTS
// Keep this API compatible with existing request screens.
// ======================================================

function statusFromApi(
  status: LeaveRequestDto['status'],
): AdminRequest['status'] {
  return status.toLowerCase() as AdminRequest['status'];
}

export async function readRequests(): Promise<AdminRequest[]> {
  const scope = await getAdminScope();

  const [leave, branches, employees, corrections] =
    await Promise.all([
      leaveApi.requests(scope.companyId),
      getBranchDirectory(),
      getEmployees().catch(() => []),
      readCorrectionRequests(),
    ]);

  const names = branchNameMap(branches);

  const employeeNames = new Map<string, string>();

  employees.forEach((employee) => {
    const profile = employee as typeof employee & {
      userId?: string;
    };

    if (profile.userId) {
      employeeNames.set(
        profile.userId,
        employee.fullName,
      );
    }
  });

  const leaveRequests: AdminRequest[] = leave.map(
    (dto) => {
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
        ...(!mine
          ? { employeeId: dto.userId }
          : {}),
        employeeName: mine
          ? scope.user.name
          : employeeNames.get(dto.userId) ??
            'Team member',
        branch: names.get(dto.branchId),
        leaveType: dto.leaveType?.name,
      };
    },
  );

  const correctionRequests: AdminRequest[] =
    corrections.map((item) => ({
      id: item.id,
      type: 'correction',
      employeeId: item.userId,
      employeeName: item.employeeName,
      branch: item.branchName,
      shiftId: item.attendanceId,
      startDate: item.attendanceDate,
      endDate: item.attendanceDate,
      reason: item.reason,
      correctCheckIn: item.requestedCheckInAt,
      correctCheckOut: item.requestedCheckOutAt,
      status: item.status.toLowerCase() as
        AdminRequest['status'],
      createdAt: item.createdAt,
      ...(item.reviewedAt
        ? { reviewedAt: item.reviewedAt }
        : {}),
      ...(item.reviewNote
        ? { reviewNote: item.reviewNote }
        : {}),
    }));

  return [
    ...leaveRequests,
    ...correctionRequests,
  ].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

// ======================================================
// LEAVE TYPE HELPER
// Existing Leave management behavior preserved.
// ======================================================

async function leaveTypeId(name: string): Promise<string> {
  const scope = await getAdminScope();

  const types = await leaveApi.types(scope.companyId);
  const wanted = name.trim().toLowerCase();

  if (!wanted) {
    throw new Error('Leave type is required.');
  }

  const existing = types.find(
    (type) =>
      type.name.toLowerCase() === wanted &&
      type.status === 'ACTIVE',
  );

  if (existing) {
    return existing.id;
  }

  const code =
    name
      .trim()
      .split(/\s+/)
      .map((part) => part.charAt(0))
      .join('')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '') || 'LV';

  const uniqueCode = types.some(
    (type) => type.code === code,
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

// ======================================================
// SAVE REQUEST STATUS CHANGES
// Retains the public contract for existing request screens.
// ======================================================

export async function saveRequests(
  next: AdminRequest[],
): Promise<void> {
  const scope = await getAdminScope();

  const current = await readRequests();

  const byId = new Map(
    current.map((request) => [request.id, request]),
  );

  for (const request of next) {
    if (request.type !== 'correction') continue;

    const before = byId.get(request.id);

    if (!before) {
      throw new Error(
        'Create corrections from the personal attendance form.',
      );
    }

    if (before.status === request.status) continue;

    if (before.status !== 'pending') {
      throw new Error(
        'Correction request was already processed.',
      );
    }

    if (request.status === 'approved') {
      await approveCorrection(request.id);
    } else if (request.status === 'rejected') {
      if (!request.reviewNote?.trim()) {
        throw new Error(
          'A rejection reason is required.',
        );
      }

      await rejectCorrection(
        request.id,
        request.reviewNote,
      );
    } else if (request.status === 'cancelled') {
      await cancelCorrection(request.id);
    } else {
      throw new Error(
        'Unsupported correction status change.',
      );
    }
  }

  // Existing Leave & Approvals integration.
  for (const request of next) {
    if (request.type !== 'leave') continue;

    const before = byId.get(request.id);

    if (!before) {
      await leaveApi.apply({
        companyId: scope.companyId,
        branchId: await myBranchId(request.branch),
        leaveTypeId: await leaveTypeId(
          request.leaveType || 'Casual leave',
        ),
        startDate: request.startDate,
        endDate: request.endDate,
        reason: request.reason,
      });

      continue;
    }

    if (before.status === request.status) continue;

    if (before.status !== 'pending') {
      throw new Error(
        'This request has already been reviewed.',
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
