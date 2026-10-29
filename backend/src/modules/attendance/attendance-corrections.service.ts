import { lateMinutes } from '../../common/shift';
import { businessDateKey, businessToday } from '../../common/business-time';
import { assertPayrollOpen } from '../../common/payroll-input-lock';
import { notify } from '../../common/notifications';
import { assertNoApprovedLeave } from '../../common/attendance-leave-conflict';
import { assertCompanyScope } from '../../common/company-scope';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  AttendanceCorrectionStatus,
  AttendanceStatus,
  Prisma,
  RecordStatus,
  UserStatus,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { AttendanceAuthUser } from './attendance.service';

import {
  CreateAttendanceCorrectionDto,
  ListAttendanceCorrectionsDto,
  ReviewAttendanceCorrectionDto,
} from './dto/attendance-correction.dto';

@Injectable()
export class AttendanceCorrectionsService {
  constructor(private readonly prisma: PrismaService) {}

  private isAdmin(user: AttendanceAuthUser): boolean {
    return user.roles.some((role) =>
      ['BUSINESS_OWNER', 'BUSINESS_ADMIN'].includes(role),
    );
  }

  private isManager(user: AttendanceAuthUser): boolean {
    return (
      this.isAdmin(user) ||
      user.roles.some(role => ['COMPANY_MANAGER', 'BRANCH_MANAGER', 'HR_MANAGER'].includes(role))
    );
  }

  private async requireActiveUser(
    user: AttendanceAuthUser,
  ): Promise<void> {
    const activeUser = await this.prisma.user.findFirst({
      where: {
        id: user.id,
        tenantId: user.tenantId,
        status: UserStatus.ACTIVE,
      },
      select: { id: true },
    });

    if (!activeUser) {
      throw new ForbiddenException('Account is not active');
    }
  }

  private async ensureScope(
    user: AttendanceAuthUser,
    companyId: string,
    branchId: string,
  ): Promise<void> {
    assertCompanyScope(user, companyId);
    const branch = await this.prisma.branch.findFirst({
      where: {
        id: branchId,
        companyId,
        status: RecordStatus.ACTIVE,
        company: {
          tenantId: user.tenantId,
          status: RecordStatus.ACTIVE,
        },
      },
      select: { id: true },
    });

    if (!branch) {
      throw new NotFoundException(
        'Active company or branch not found',
      );
    }

    // Match the existing attendance administrator policy.
    if (this.isAdmin(user)) return;

    const [companyAccess, branchAccess] =
      await Promise.all([
        this.prisma.userCompanyAccess.findUnique({
          where: {
            userId_companyId: {
              userId: user.id,
              companyId,
            },
          },
          select: { userId: true },
        }),
        this.prisma.userBranchAccess.findUnique({
          where: {
            userId_branchId: {
              userId: user.id,
              branchId,
            },
          },
          select: { userId: true },
        }),
      ]);

    if (!companyAccess || !branchAccess) {
      throw new ForbiddenException(
        'Company or branch access denied',
      );
    }
  }

  private parseRequestedTimes(
    input: CreateAttendanceCorrectionDto,
    attendanceDate: Date,
  ) {
    const checkIn = new Date(input.requestedCheckInAt);
    const checkOut = new Date(input.requestedCheckOutAt);

    if (
      Number.isNaN(checkIn.getTime()) ||
      Number.isNaN(checkOut.getTime())
    ) {
      throw new BadRequestException(
        'Invalid requested check-in or check-out timestamp',
      );
    }

    if (checkOut <= checkIn) {
      throw new BadRequestException(
        'Check-out must be after check-in',
      );
    }

    const minutes = Math.floor(
      (checkOut.getTime() - checkIn.getTime()) / 60000,
    );

    if (minutes < 1 || minutes > 1440) {
      throw new BadRequestException(
        'Requested shift must be between 1 minute and 24 hours',
      );
    }

    // Validate against the business date, including early morning shifts.
    if (
      businessDateKey(checkIn) !==
      attendanceDate.toISOString().slice(0, 10)
    ) {
      throw new BadRequestException(
        'Requested check-in must belong to the attendance business date',
      );
    }

    if (checkOut.getTime() > Date.now()) {
      throw new BadRequestException(
        'Correction times cannot be in the future',
      );
    }

    return { checkIn, checkOut, minutes };
  }

  private handleTransactionError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2034'
    ) {
      throw new ConflictException(
        'Attendance changed concurrently. Refresh and retry.',
      );
    }

    throw error;
  }

  // =====================================================
  // SUBMIT CORRECTION
  // =====================================================

  async create(user: AttendanceAuthUser, dto: CreateAttendanceCorrectionDto) {
    await this.requireActiveUser(user);
    const attendance = dto.attendanceId ? await this.prisma.attendance.findFirst({ where: { id: dto.attendanceId, tenantId: user.tenantId, userId: user.id } }) : null;
    if (dto.attendanceId && !attendance) throw new NotFoundException('Your attendance record was not found');
    const companyId = attendance?.companyId ?? dto.companyId;
    const branchId = attendance?.branchId ?? dto.branchId;
    if (!companyId || !branchId || (!attendance && !dto.attendanceDate)) throw new BadRequestException('Company, branch and attendance date are required for a missing shift');
    await this.ensureScope(user, companyId, branchId);
    const attendanceDate = attendance?.attendanceDate ?? new Date(dto.attendanceDate + 'T00:00:00.000Z');
    if (Number.isNaN(attendanceDate.getTime()) || attendanceDate.toISOString().slice(0, 10) !== (attendance?.attendanceDate.toISOString().slice(0,10) ?? dto.attendanceDate) || attendanceDate > businessToday()) throw new BadRequestException('Choose a valid attendance date on or before today');
    if (attendance?.status === 'ON_LEAVE') throw new ConflictException('Resolve the leave record before requesting attendance changes');
    const profile = await this.prisma.employeeProfile.findFirst({ where: { tenantId: user.tenantId, companyId, branchId, userId: user.id, status: 'ACTIVE', joiningDate: { lte: attendanceDate } }, select: { id: true } });
    if (!profile) throw new ForbiddenException('An active employee assignment is required for this date');
    const reason = dto.reason.trim();
    if (!reason) throw new BadRequestException('Correction reason is required');
    const { checkIn, checkOut } = this.parseRequestedTimes(dto, attendanceDate);
    try {
      return await this.prisma.$transaction(async tx => {
        await assertPayrollOpen(tx, { tenantId: user.tenantId, companyId, branchId }, attendanceDate);
        const current = await tx.attendance.findFirst({ where: { tenantId: user.tenantId, companyId, branchId, userId: user.id, attendanceDate } });
        if ((attendance && (!current || current.id !== attendance.id || current.status === 'ON_LEAVE')) || (!attendance && current)) throw new ConflictException('Attendance changed. Refresh and retry');
        const pending = await tx.attendanceCorrectionRequest.findFirst({ where: { tenantId: user.tenantId, companyId, branchId, userId: user.id, requestedAttendanceDate: attendanceDate, status: 'PENDING' }, select: { id: true } });
        if (pending) throw new ConflictException('A correction request is already pending for this date');
        const created = await tx.attendanceCorrectionRequest.create({ data: { tenantId: user.tenantId, companyId, branchId, userId: user.id, attendanceId: current?.id, requestedAttendanceDate: attendanceDate, requestedCheckInAt: checkIn, requestedCheckOutAt: checkOut, reason } });
        const reviewers = await tx.user.findMany({ where: { tenantId: user.tenantId, status: 'ACTIVE', id: { not: user.id }, roles: { some: { OR: [{ companyId: null, role: { name: { in: ['BUSINESS_OWNER', 'BUSINESS_ADMIN'] } } }, { companyId }], role: { name: { in: ['BUSINESS_OWNER', 'BUSINESS_ADMIN', 'COMPANY_MANAGER', 'BRANCH_MANAGER', 'HR_MANAGER'] } } } }, OR: [{ roles: { some: { companyId: null, role: { name: 'BUSINESS_OWNER' } } } }, { companyAccess: { some: { companyId } }, branchAccess: { some: { branchId } } }] }, select: { id: true } });
        for (const reviewer of reviewers) await notify(tx, user.tenantId, companyId, reviewer.id, 'Attendance review requested', 'An attendance correction is awaiting review.', '/admin/attendance/corrections');
        return created;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) { this.handleTransactionError(error); }
  }

  // =====================================================
  // MY CORRECTION REQUESTS
  // =====================================================

  async myRequests(user: AttendanceAuthUser) {
    await this.requireActiveUser(user);

    return this.prisma.attendanceCorrectionRequest.findMany({
      where: {
        tenantId: user.tenantId,
        userId: user.id,
      },
      include: {
        attendance: {
          select: {
            attendanceDate: true,
            checkInAt: true,
            checkOutAt: true,
            status: true,
          },
        },
      },
      orderBy: [
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
    });
  }

  // =====================================================
  // ADMIN / MANAGER REQUEST LIST
  // =====================================================

  async list(
    user: AttendanceAuthUser,
    query: ListAttendanceCorrectionsDto,
  ) {
    if (!this.isManager(user)) {
      throw new ForbiddenException(
        'Only authorized managers can review team corrections',
      );
    }

    await this.requireActiveUser(user);

    const company = await this.prisma.company.findFirst({
      where: {
        id: query.companyId,
        tenantId: user.tenantId,
        status: RecordStatus.ACTIVE,
      },
      select: { id: true },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    const where: Prisma.AttendanceCorrectionRequestWhereInput = {
      tenantId: user.tenantId,
      companyId: query.companyId,

      ...(query.branchId
        ? { branchId: query.branchId }
        : {}),

      ...(query.status
        ? { status: query.status }
        : {}),
    };

    if (this.isAdmin(user)) {
      if (query.branchId) {
        await this.ensureScope(
          user,
          query.companyId,
          query.branchId,
        );
      }
    } else {
      const [companyAccess, branchAccess] =
        await Promise.all([
          this.prisma.userCompanyAccess.findUnique({
            where: {
              userId_companyId: {
                userId: user.id,
                companyId: query.companyId,
              },
            },
            select: { userId: true },
          }),

          this.prisma.userBranchAccess.findMany({
            where: {
              userId: user.id,
              branch: {
                companyId: query.companyId,
                status: RecordStatus.ACTIVE,
              },
            },
            select: { branchId: true },
          }),
        ]);

      if (!companyAccess) {
        throw new ForbiddenException(
          'Company access denied',
        );
      }

      const allowedBranchIds = branchAccess.map(
        (item) => item.branchId,
      );

      if (
        query.branchId &&
        !allowedBranchIds.includes(query.branchId)
      ) {
        throw new ForbiddenException(
          'Branch access denied',
        );
      }

      // Intersect the requested scope with authorized branches.
      where.AND = [
        {
          branchId: {
            in: allowedBranchIds,
          },
        },
      ];
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    if (
      !Number.isSafeInteger(page) ||
      page < 1 ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 100 ||
      !Number.isSafeInteger((page - 1) * limit)
    ) {
      throw new BadRequestException(
        'Invalid pagination values',
      );
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.attendanceCorrectionRequest.findMany({
        where,
        include: {
          requestedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          attendance: {
            select: {
              attendanceDate: true,
              checkInAt: true,
              checkOutAt: true,
              status: true,
            },
          },
        },
        orderBy: [
          { createdAt: 'desc' },
          { id: 'desc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.attendanceCorrectionRequest.count({
        where,
      }),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // =====================================================
  // APPROVE OR REJECT
  // =====================================================

  async review(
    user: AttendanceAuthUser,
    id: string,
    approve: boolean,
    dto: ReviewAttendanceCorrectionDto,
  ) {
    if (!this.isManager(user)) {
      throw new ForbiddenException(
        'Only authorized managers can review corrections',
      );
    }

    await this.requireActiveUser(user);

    const existing =
      await this.prisma.attendanceCorrectionRequest.findFirst({
        where: {
          id,
          tenantId: user.tenantId,
        },
      });

    if (!existing) {
      throw new NotFoundException(
        'Correction request not found',
      );
    }

    await this.ensureScope(
      user,
      existing.companyId,
      existing.branchId,
    );

    if (existing.userId === user.id) {
      throw new ForbiddenException(
        'You cannot approve or reject your own correction request',
      );
    }

    const note = dto.note?.trim() || null;

    if (!approve && !note) {
      throw new BadRequestException(
        'A reason is required when rejecting a correction',
      );
    }

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const correction =
            await tx.attendanceCorrectionRequest.findFirst({
              where: {
                id,
                tenantId: user.tenantId,
                companyId: existing.companyId,
                branchId: existing.branchId,
              },
              include: {
                attendance: true,
              },
            });

          if (!correction) {
            throw new NotFoundException(
              'Correction request not found',
            );
          }

          if (
            correction.status !==
            AttendanceCorrectionStatus.PENDING
          ) {
            throw new ConflictException(
              'This correction has already been processed',
            );
          }

          if (correction.userId === user.id) {
            throw new ForbiddenException(
              'You cannot review your own request',
            );
          }

          if (approve) {
            await assertNoApprovedLeave(tx, user.tenantId, correction.companyId, correction.userId, correction.requestedAttendanceDate);
            await assertPayrollOpen(tx, { tenantId: user.tenantId, companyId: correction.companyId, branchId: correction.branchId }, correction.requestedAttendanceDate);
            const attendance = correction.attendance;
            const shift = await tx.branch.findUniqueOrThrow({ where: { id: correction.branchId }, select: { shiftStart: true, graceMinutes: true } });
            const { checkIn, checkOut, minutes } = this.parseRequestedTimes({ requestedCheckInAt: correction.requestedCheckInAt.toISOString(), requestedCheckOutAt: correction.requestedCheckOutAt.toISOString() } as CreateAttendanceCorrectionDto, correction.requestedAttendanceDate);
            if (attendance) {
              if (attendance.tenantId !== correction.tenantId || attendance.companyId !== correction.companyId || attendance.branchId !== correction.branchId || attendance.userId !== correction.userId || attendance.status === 'ON_LEAVE' || attendance.updatedAt > correction.createdAt) throw new ConflictException('Attendance changed since submission. Submit a new request');
              const updated = await tx.attendance.updateMany({ where: { id: attendance.id, updatedAt: attendance.updatedAt }, data: { status: 'PRESENT', checkInAt: checkIn, checkOutAt: checkOut, totalMinutes: minutes, lateMinutes: lateMinutes(shift, checkIn), source: 'MANUAL', markedById: user.id } });
              if (updated.count !== 1) throw new ConflictException('Attendance changed during review');
            } else {
              const created = await tx.attendance.create({ data: { tenantId: correction.tenantId, companyId: correction.companyId, branchId: correction.branchId, userId: correction.userId, attendanceDate: correction.requestedAttendanceDate, status: 'PRESENT', checkInAt: checkIn, checkOutAt: checkOut, totalMinutes: minutes, lateMinutes: lateMinutes(shift, checkIn), source: 'MANUAL', markedById: user.id } });
              await tx.attendanceCorrectionRequest.update({ where: { id: correction.id }, data: { attendanceId: created.id } });
            }
            await tx.auditEvent.create({ data: { tenantId: user.tenantId, companyId: correction.companyId, branchId: correction.branchId, actorId: user.id, module: 'ATTENDANCE', action: 'ATTENDANCE_CORRECTED', targetId: correction.id, detail: 'Reviewed attendance correction applied' } });
          }

          const decided =
            await tx.attendanceCorrectionRequest.updateMany({
              where: {
                id: correction.id,
                tenantId: user.tenantId,
                status: AttendanceCorrectionStatus.PENDING,
              },
              data: {
                status: approve
                  ? AttendanceCorrectionStatus.APPROVED
                  : AttendanceCorrectionStatus.REJECTED,
                reviewedById: user.id,
                reviewedAt: new Date(),
                reviewNote: note,
              },
            });

          if (decided.count !== 1) {
            throw new ConflictException(
              'Correction was already reviewed',
            );
          }

          await notify(tx, user.tenantId, correction.companyId, correction.userId, 'Attendance request reviewed', `Your correction request was ${approve ? 'approved' : 'rejected'}.`, '/employee/attendance/correction');
          return tx.attendanceCorrectionRequest.findUniqueOrThrow({
            where: {
              id: correction.id,
            },
          });
        },
        {
          isolationLevel:
            Prisma.TransactionIsolationLevel.Serializable,
        },
      );
    } catch (error) {
      this.handleTransactionError(error);
    }
  }

  // =====================================================
  // CANCEL OWN PENDING REQUEST
  // =====================================================

  async cancel(
    user: AttendanceAuthUser,
    id: string,
  ) {
    await this.requireActiveUser(user);

    const result =
      await this.prisma.attendanceCorrectionRequest.updateMany({
        where: {
          id,
          tenantId: user.tenantId,
          userId: user.id,
          status: AttendanceCorrectionStatus.PENDING,
        },
        data: {
          status: AttendanceCorrectionStatus.CANCELLED,
        },
      });

    if (result.count !== 1) {
      throw new ConflictException(
        'Pending correction not found or already processed',
      );
    }

    return this.prisma.attendanceCorrectionRequest.findUniqueOrThrow({
      where: { id },
    });
  }
}
