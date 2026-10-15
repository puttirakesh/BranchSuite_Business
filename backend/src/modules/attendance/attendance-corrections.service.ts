
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
      user.roles.includes('BRANCH_MANAGER')
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

    // The existing attendance system uses UTC dates.
    if (
      checkIn.toISOString().slice(0, 10) !==
      attendanceDate.toISOString().slice(0, 10)
    ) {
      throw new BadRequestException(
        'Requested check-in must belong to the attendance UTC date',
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

  async create(
    user: AttendanceAuthUser,
    dto: CreateAttendanceCorrectionDto,
  ) {
    await this.requireActiveUser(user);

    const attendance = await this.prisma.attendance.findFirst({
      where: {
        id: dto.attendanceId,
        tenantId: user.tenantId,
        userId: user.id,
      },
    });

    if (!attendance) {
      throw new NotFoundException(
        'Your attendance record was not found',
      );
    }

    await this.ensureScope(
      user,
      attendance.companyId,
      attendance.branchId,
    );

    if (attendance.status !== AttendanceStatus.PRESENT) {
      throw new ConflictException(
        'Only present attendance records can have time corrections',
      );
    }

    const reason = dto.reason.trim();

    if (!reason) {
      throw new BadRequestException(
        'Correction reason is required',
      );
    }

    const { checkIn, checkOut } =
      this.parseRequestedTimes(
        dto,
        attendance.attendanceDate,
      );

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const current = await tx.attendance.findFirst({
            where: {
              id: attendance.id,
              tenantId: user.tenantId,
              companyId: attendance.companyId,
              branchId: attendance.branchId,
              userId: user.id,
            },
          });

          if (
            !current ||
            current.status !== AttendanceStatus.PRESENT
          ) {
            throw new ConflictException(
              'Attendance is no longer eligible for correction',
            );
          }

          const pending =
            await tx.attendanceCorrectionRequest.findFirst({
              where: {
                attendanceId: current.id,
                tenantId: user.tenantId,
                status: AttendanceCorrectionStatus.PENDING,
              },
              select: { id: true },
            });

          if (pending) {
            throw new ConflictException(
              'A correction request is already pending for this shift',
            );
          }

          return tx.attendanceCorrectionRequest.create({
            data: {
              tenantId: current.tenantId,
              companyId: current.companyId,
              branchId: current.branchId,
              userId: user.id,
              attendanceId: current.id,
              requestedCheckInAt: checkIn,
              requestedCheckOutAt: checkOut,
              reason,
              status: AttendanceCorrectionStatus.PENDING,
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
            const attendance = correction.attendance;

            if (
              attendance.tenantId !== correction.tenantId ||
              attendance.companyId !== correction.companyId ||
              attendance.branchId !== correction.branchId ||
              attendance.userId !== correction.userId
            ) {
              throw new ConflictException(
                'Attendance ownership does not match the request',
              );
            }

            if (
              attendance.status !== AttendanceStatus.PRESENT
            ) {
              throw new ConflictException(
                'Attendance is no longer eligible for correction',
              );
            }

            if (
              attendance.updatedAt.getTime() >
              correction.createdAt.getTime()
            ) {
              throw new ConflictException(
                'Attendance has changed since the request was submitted',
              );
            }

            const checkIn =
              correction.requestedCheckInAt;

            const checkOut =
              correction.requestedCheckOutAt;

            const totalMinutes = Math.floor(
              (checkOut.getTime() - checkIn.getTime()) /
                60000,
            );

            if (
              checkOut <= checkIn ||
              totalMinutes < 1 ||
              totalMinutes > 1440 ||
              checkIn.toISOString().slice(0, 10) !==
                attendance.attendanceDate
                  .toISOString()
                  .slice(0, 10)
            ) {
              throw new ConflictException(
                'Stored correction times are invalid',
              );
            }

            const updated = await tx.attendance.updateMany({
              where: {
                id: attendance.id,
                tenantId: correction.tenantId,
                companyId: correction.companyId,
                branchId: correction.branchId,
                userId: correction.userId,
                status: AttendanceStatus.PRESENT,
                updatedAt: attendance.updatedAt,
              },
              data: {
                checkInAt: checkIn,
                checkOutAt: checkOut,
                totalMinutes,
              },
            });

            if (updated.count !== 1) {
              throw new ConflictException(
                'Attendance was modified during review',
              );
            }
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
