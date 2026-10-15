
import { api } from '../api/client';
import { call, fetchAll } from './http';
import { getAdminScope } from './scope';

export type CorrectionStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED';

export type AttendanceCorrectionDto = {
  id: string;
  tenantId: string;
  companyId: string;
  branchId: string;
  userId: string;
  attendanceId: string;

  requestedCheckInAt: string;
  requestedCheckOutAt: string;

  reason: string;
  status: CorrectionStatus;

  reviewedById: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;

  createdAt: string;
  updatedAt: string;

  requestedBy?: {
    id: string;
    name: string;
    email: string;
  };

  attendance?: {
    attendanceDate: string;
    checkInAt: string | null;
    checkOutAt: string | null;
    status: string;
  };
};

export type SubmitCorrectionInput = {
  attendanceId: string;
  date: string;
  checkIn: string;
  checkOut: string;
  reason: string;
};

// The attendance backend currently uses UTC attendance dates.
// This helper converts device-local selected times into ISO timestamps.
function localTimeToIso(
  date: string,
  time: string,
): string {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)
  ) {
    throw new Error('Invalid attendance date or time.');
  }

  const value = new Date(`${date}T${time}:00`);

  if (
    Number.isNaN(value.getTime()) ||
    value.getFullYear() !== Number(date.slice(0, 4)) ||
    value.getMonth() + 1 !== Number(date.slice(5, 7)) ||
    value.getDate() !== Number(date.slice(8, 10)) ||
    value.getHours() !== Number(time.slice(0, 2)) ||
    value.getMinutes() !== Number(time.slice(3, 5))
  ) {
    throw new Error('Invalid attendance date or time.');
  }

  return value.toISOString();
}

export async function submitAttendanceCorrection(
  input: SubmitCorrectionInput,
): Promise<AttendanceCorrectionDto> {
  const reason = input.reason.trim();

  if (!reason) {
    throw new Error('Enter a reason for the correction.');
  }

  const requestedCheckInAt = localTimeToIso(
    input.date,
    input.checkIn,
  );

  const requestedCheckOutAt = localTimeToIso(
    input.date,
    input.checkOut,
  );

  const duration =
    new Date(requestedCheckOutAt).getTime() -
    new Date(requestedCheckInAt).getTime();

  if (duration < 60000 || duration > 86400000) {
    throw new Error(
      'Check-out must be after check-in, within 24 hours.',
    );
  }

  // This condition matches the current backend rule.
  // Early-morning local shifts crossing a UTC day boundary
  // need a future timezone-policy enhancement.
  if (
    requestedCheckInAt.slice(0, 10) !== input.date
  ) {
    throw new Error(
      'The selected check-in crosses the UTC attendance date. ' +
        'This shift needs a timezone-aware correction policy.',
    );
  }

  return call(
    api.post<AttendanceCorrectionDto>(
      '/attendance/corrections',
      {
        attendanceId: input.attendanceId,
        requestedCheckInAt,
        requestedCheckOutAt,
        reason,
      },
    ),
  );
}

export function readMyCorrections():
  Promise<AttendanceCorrectionDto[]> {
  return call(
    api.get<AttendanceCorrectionDto[]>(
      '/attendance/corrections/my',
    ),
  );
}

export async function readTeamCorrections(
  status?: CorrectionStatus,
): Promise<AttendanceCorrectionDto[]> {
  const scope = await getAdminScope();

  return fetchAll<AttendanceCorrectionDto>((page) =>
    call(
      api.get('/attendance/corrections', {
        params: {
          companyId: scope.companyId,
          ...(status ? { status } : {}),
          page,
          limit: 100,
        },
      }),
    ),
  );
}

export function approveAttendanceCorrection(
  id: string,
  note?: string,
): Promise<AttendanceCorrectionDto> {
  return call(
    api.patch<AttendanceCorrectionDto>(
      `/attendance/corrections/${id}/approve`,
      { note },
    ),
  );
}

export function rejectAttendanceCorrection(
  id: string,
  note: string,
): Promise<AttendanceCorrectionDto> {
  if (!note.trim()) {
    throw new Error('Enter a rejection reason.');
  }

  return call(
    api.patch<AttendanceCorrectionDto>(
      `/attendance/corrections/${id}/reject`,
      { note: note.trim() },
    ),
  );
}

export function cancelAttendanceCorrection(
  id: string,
): Promise<AttendanceCorrectionDto> {
  return call(
    api.patch<AttendanceCorrectionDto>(
      `/attendance/corrections/${id}/cancel`,
      {},
    ),
  );
}
