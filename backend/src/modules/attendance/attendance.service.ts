import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  AttendanceSource,
  AttendanceStatus,
  Prisma,
  RecordStatus,
  UserStatus,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { ListAttendanceDto } from './dto/list-attendance.dto';

export interface AttendanceAuthUser {
  id: string;
  tenantId: string;
  roles: string[];
}

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  private time12hIST(value: Date | null): string | null {
    if (!value) return null;

    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(value);
  }

  private attendanceResponse<T extends {
    checkInAt: Date | null;
    checkOutAt: Date | null;
  }>(record: T) {
    return {
      ...record,
      checkInTime12h: this.time12hIST(record.checkInAt),
      checkOutTime12h: this.time12hIST(record.checkOutAt),
    };
  }

  // =====================================================
  // ROLES
  // =====================================================

  private isAdmin(
    user: AttendanceAuthUser,
  ): boolean {
    return user.roles.some((role) =>
      ['BUSINESS_OWNER', 'BUSINESS_ADMIN'].includes(role),
    );
  }

  private isManager(
    user: AttendanceAuthUser,
  ): boolean {
    return (
      this.isAdmin(user) ||
      user.roles.some(role => ['COMPANY_MANAGER', 'BRANCH_MANAGER', 'HR_MANAGER'].includes(role))
    );
  }

  // =====================================================
  // DATES
  // =====================================================

  private dateOnly(value: string): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestException(
        'Invalid calendar date; use YYYY-MM-DD',
      );
    }

    const date = new Date(
      `${value}T00:00:00.000Z`,
    );

    if (
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== value
    ) {
      throw new BadRequestException(
        'Invalid calendar date; use YYYY-MM-DD',
      );
    }

    return date;
  }

  private utcToday(now: Date): Date {
    return this.dateOnly(
      now.toISOString().slice(0, 10),
    );
  }

  // =====================================================
  // COMPANY / BRANCH AUTHORIZATION
  // =====================================================

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
      select: {
        id: true,
      },
    });

    if (!branch) {
      throw new NotFoundException(
        'Active company/branch not found',
      );
    }

    // Preserve the existing tenant-wide administrator policy.
    // This does not allow access to another tenant.
    if (this.isAdmin(user)) {
      return;
    }

    const [companyAccess, branchAccess] = await Promise.all([
      this.prisma.userCompanyAccess.findUnique({
        where: {
          userId_companyId: {
            userId: user.id,
            companyId,
          },
        },
        select: {
          userId: true,
        },
      }),

      this.prisma.userBranchAccess.findUnique({
        where: {
          userId_branchId: {
            userId: user.id,
            branchId,
          },
        },
        select: {
          userId: true,
        },
      }),
    ]);

    if (!companyAccess || !branchAccess) {
      throw new ForbiddenException(
        'Company or branch access denied',
      );
    }
  }

  // =====================================================
  // TARGET USER VALIDATION
  // =====================================================

  private async ensureEmployee(
    tenantId: string,
    userId: string,
    companyId: string,
    branchId: string,
  ): Promise<void> {
    const employee = await this.prisma.user.findFirst({
      where: {
        id: userId,
        tenantId,
        status: UserStatus.ACTIVE,
      },
      select: {
        id: true,
        roles: {
          select: {
            role: {
              select: {
                name: true,
              },
            },
          },
        },
        companyAccess: {
          where: {
            companyId,
          },
          select: {
            companyId: true,
          },
        },
        branchAccess: {
          where: {
            branchId,
          },
          select: {
            branchId: true,
          },
        },
      },
    });

    if (!employee) {
      throw new NotFoundException(
        'Active employee not found',
      );
    }

    const isBusinessAdmin = employee.roles.some(
      ({ role }) =>
        ['BUSINESS_OWNER', 'BUSINESS_ADMIN'].includes(
          role.name,
        ),
    );

    // Preserve the existing behavior for administrator accounts.
    if (
      !isBusinessAdmin &&
      (
        employee.companyAccess.length === 0 ||
        employee.branchAccess.length === 0
      )
    ) {
      throw new BadRequestException(
        'Employee does not have access to the selected company/branch',
      );
    }
  }

  // =====================================================
  // QUERY FILTERS AND VISIBILITY
  // =====================================================

  private async visibleWhere(
    user: AttendanceAuthUser,
    query: ListAttendanceDto,
    selfOnly: boolean,
  ): Promise<Prisma.AttendanceWhereInput> {
    if (query.branchId && !query.companyId) {
      throw new BadRequestException(
        'companyId is required when branchId is provided',
      );
    }

    const fromDate = query.fromDate
      ? this.dateOnly(query.fromDate)
      : undefined;

    const toDate = query.toDate
      ? this.dateOnly(query.toDate)
      : undefined;

    if (
      fromDate &&
      toDate &&
      fromDate > toDate
    ) {
      throw new BadRequestException(
        'fromDate must be on or before toDate',
      );
    }

    const canViewTeam =
      (this.isManager(user) || user.roles.includes('PAYROLL_MANAGER')) && !selfOnly;

    if (
      query.userId &&
      !canViewTeam &&
      query.userId !== user.id
    ) {
      throw new ForbiddenException(
        'You can only view your own attendance',
      );
    }

    const where: Prisma.AttendanceWhereInput = {
      tenantId: user.tenantId,

      company: {
        tenantId: user.tenantId,
        status: RecordStatus.ACTIVE,
      },

      branch: {
        status: RecordStatus.ACTIVE,
      },

      // Keep these explicit request filters.
      ...(query.companyId
        ? { companyId: query.companyId }
        : {}),

      ...(query.branchId
        ? { branchId: query.branchId }
        : {}),

      ...(query.status
        ? { status: query.status }
        : {}),

      ...(canViewTeam
        ? (
            query.userId
              ? { userId: query.userId }
              : {}
          )
        : { userId: user.id }),

      ...(fromDate || toDate
        ? {
            attendanceDate: {
              ...(fromDate
                ? { gte: fromDate }
                : {}),
              ...(toDate
                ? { lte: toDate }
                : {}),
            },
          }
        : {}),
    };

    if (this.isAdmin(user)) {
      return where;
    }

    const [companies, branches] = await Promise.all([
      this.prisma.userCompanyAccess.findMany({
        where: {
          userId: user.id,
        },
        select: {
          companyId: true,
        },
      }),

      this.prisma.userBranchAccess.findMany({
        where: {
          userId: user.id,
        },
        select: {
          branchId: true,
        },
      }),
    ]);

    const allowedCompanyIds = companies.map(
      (access) => access.companyId,
    );

    const allowedBranchIds = branches.map(
      (access) => access.branchId,
    );

    if (
      query.companyId &&
      !allowedCompanyIds.includes(query.companyId)
    ) {
      throw new ForbiddenException(
        'Company access denied',
      );
    }

    if (
      query.branchId &&
      !allowedBranchIds.includes(query.branchId)
    ) {
      throw new ForbiddenException(
        'Branch access denied',
      );
    }

    // IMPORTANT:
    // Intersect access restrictions with the requested filters.
    //
    // Do not overwrite where.companyId or where.branchId.
    // Otherwise selecting one branch could return every branch
    // to which the user has access.
    //
    // Empty access arrays intentionally match no records.
    where.AND = [
      {
        companyId: {
          in: allowedCompanyIds,
        },
      },
      {
        branchId: {
          in: allowedBranchIds,
        },
      },
    ];

    return where;
  }

  // =====================================================
  // CHECK IN
  // =====================================================

  async checkIn(
    user: AttendanceAuthUser,
    dto: CheckInDto,
  ) {
    await this.ensureScope(
      user,
      dto.companyId,
      dto.branchId,
    );

    await this.ensureEmployee(
      user.tenantId,
      user.id,
      dto.companyId,
      dto.branchId,
    );

    const now = new Date();

    try {
      const attendance = await this.prisma.attendance.create({
        data: {
          tenantId: user.tenantId,
          companyId: dto.companyId,
          branchId: dto.branchId,
          userId: user.id,
          attendanceDate: this.utcToday(now),
          checkInAt: now,
          status: AttendanceStatus.PRESENT,
          source: AttendanceSource.SELF,
        },
      });

      return this.attendanceResponse(attendance);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException(
          'Attendance already recorded for this employee, branch and UTC date',
        );
      }

      throw error;
    }
  }

  // =====================================================
  // CHECK OUT
  // =====================================================

  async checkOut(
    user: AttendanceAuthUser,
    dto: CheckOutDto,
  ) {
    await this.ensureScope(
      user,
      dto.companyId,
      dto.branchId,
    );

    // Apply the same current-user validation as check-in.
    await this.ensureEmployee(
      user.tenantId,
      user.id,
      dto.companyId,
      dto.branchId,
    );

    const now = new Date();
    const attendanceDate = this.utcToday(now);

    const attendance =
      await this.prisma.attendance.findUnique({
        where: {
          tenantId_companyId_branchId_userId_attendanceDate: {
            tenantId: user.tenantId,
            companyId: dto.companyId,
            branchId: dto.branchId,
            userId: user.id,
            attendanceDate,
          },
        },
      });

    if (!attendance) {
      throw new NotFoundException(
        'No check-in found for today',
      );
    }

    if (
      !attendance.checkInAt ||
      attendance.checkOutAt ||
      attendance.status !== AttendanceStatus.PRESENT
    ) {
      throw new ConflictException(
        'Attendance is not open for check-out',
      );
    }

    if (
      now.getTime() <
      attendance.checkInAt.getTime()
    ) {
      throw new ConflictException(
        'Check-out time is earlier than check-in. Check the server clock and attendance record.',
      );
    }

    const totalMinutes = Math.floor(
      (
        now.getTime() -
        attendance.checkInAt.getTime()
      ) / 60000,
    );

    // Conditional update prevents two checkout requests
    // from both modifying the same open record.
    const updated =
      await this.prisma.attendance.updateMany({
        where: {
          id: attendance.id,
          tenantId: user.tenantId,
          companyId: dto.companyId,
          branchId: dto.branchId,
          userId: user.id,
          attendanceDate,
          status: AttendanceStatus.PRESENT,
          checkInAt: attendance.checkInAt,
          checkOutAt: null,
        },
        data: {
          checkOutAt: now,
          totalMinutes,
        },
      });

    if (updated.count !== 1) {
      throw new ConflictException(
        'Attendance changed or has already been checked out. Refresh before retrying.',
      );
    }

    const updatedAttendance = await this.prisma.attendance.findUniqueOrThrow({
      where: {
        id: attendance.id,
      },
    });

    return this.attendanceResponse(updatedAttendance);
  }

  // =====================================================
  // MANUAL MARKING
  // =====================================================

  async mark(
    user: AttendanceAuthUser,
    dto: MarkAttendanceDto,
  ) {
    if (!this.isManager(user)) {
      throw new ForbiddenException(
        'Only managers can mark attendance manually',
      );
    }

    await this.ensureScope(
      user,
      dto.companyId,
      dto.branchId,
    );

    await this.ensureEmployee(
      user.tenantId,
      dto.userId,
      dto.companyId,
      dto.branchId,
    );

    const attendanceDate =
      this.dateOnly(dto.attendanceDate);

    if (
      attendanceDate >
      this.utcToday(new Date())
    ) {
      throw new BadRequestException(
        'Cannot manually mark attendance for a future date',
      );
    }

    try {
      const attendance = await this.prisma.attendance.create({
        data: {
          tenantId: user.tenantId,
          companyId: dto.companyId,
          branchId: dto.branchId,
          userId: dto.userId,
          attendanceDate,
          status: dto.status,
          source: AttendanceSource.MANUAL,
          notes: dto.notes,
          markedById: user.id,
        },
      });

      return this.attendanceResponse(attendance);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException(
          'Attendance already exists; manual marking will not overwrite it',
        );
      }

      throw error;
    }
  }

  // =====================================================
  // LIST ATTENDANCE
  // =====================================================

  async findAll(
    user: AttendanceAuthUser,
    query: ListAttendanceDto,
    selfOnly = false,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    if (
      !Number.isSafeInteger(page) ||
      page < 1 ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 100
    ) {
      throw new BadRequestException(
        'page must be a positive integer and limit must be between 1 and 100',
      );
    }

    const skip = (page - 1) * limit;

    if (!Number.isSafeInteger(skip)) {
      throw new BadRequestException(
        'Requested page is too large',
      );
    }

    const where = await this.visibleWhere(
      user,
      query,
      selfOnly,
    );

    const [data, total] =
      await this.prisma.$transaction([
        this.prisma.attendance.findMany({
          where,
          orderBy: [
            { attendanceDate: 'desc' },
            { createdAt: 'desc' },
            { id: 'desc' },
          ],
          skip,
          take: limit,
        }),

        this.prisma.attendance.count({
          where,
        }),
      ]);

    return {
      data: data.map((record) =>
        this.attendanceResponse(record),
      ),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // =====================================================
  // GET ONE ATTENDANCE RECORD
  // =====================================================

  async findOne(
    user: AttendanceAuthUser,
    id: string,
  ) {
    const attendance =
      await this.prisma.attendance.findFirst({
        where: {
          id,
          tenantId: user.tenantId,
        },
      });

    if (!attendance) {
      throw new NotFoundException(
        'Attendance not found',
      );
    }

    await this.ensureScope(
      user,
      attendance.companyId,
      attendance.branchId,
    );

    if (
      !this.isManager(user) &&
      attendance.userId !== user.id
    ) {
      throw new ForbiddenException(
        'You can only view your own attendance',
      );
    }

    return this.attendanceResponse(attendance);
  }

  // =====================================================
  // DATABASE ERROR CLASSIFICATION
  // =====================================================

  private isUniqueViolation(
    error: unknown,
  ): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
