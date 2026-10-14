import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AttendanceSource,
  AttendanceStatus,
  Prisma,
  RecordStatus,
  UserStatus,
} from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CheckInDto } from "./dto/check-in.dto";
import { CheckOutDto } from "./dto/check-out.dto";
import { MarkAttendanceDto } from "./dto/mark-attendance.dto";
import { ListAttendanceDto } from "./dto/list-attendance.dto";

export interface AttendanceAuthUser {
  id: string;
  tenantId: string;
  roles: string[];
}

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) { }

  private isAdmin(user: AttendanceAuthUser): boolean {
    return user.roles.some((role) =>
      ["BUSINESS_OWNER", "BUSINESS_ADMIN"].includes(role),
    );
  }

  private isManager(user: AttendanceAuthUser): boolean {
    return this.isAdmin(user) || user.roles.includes("BRANCH_MANAGER");
  }

  private dateOnly(value: string): Date {
    const date = new Date(`${value}T00:00:00.000Z`);
    if (
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== value
    ) {
      throw new BadRequestException("Invalid calendar date; use YYYY-MM-DD");
    }
    return date;
  }

  private utcToday(now: Date): Date {
    return this.dateOnly(now.toISOString().slice(0, 10));
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
        company: { tenantId: user.tenantId, status: RecordStatus.ACTIVE },
      },
      select: { id: true },
    });
    if (!branch) throw new NotFoundException("Active company/branch not found");
    if (this.isAdmin(user)) return;

    const [companyAccess, branchAccess] = await Promise.all([
      this.prisma.userCompanyAccess.findUnique({
        where: { userId_companyId: { userId: user.id, companyId } },
        select: { userId: true },
      }),
      this.prisma.userBranchAccess.findUnique({
        where: { userId_branchId: { userId: user.id, branchId } },
        select: { userId: true },
      }),
    ]);
    if (!companyAccess || !branchAccess) {
      throw new ForbiddenException("Company or branch access denied");
    }
  }

  private async ensureEmployee(
    tenantId: string,
    userId: string,
    companyId: string,
    branchId: string,
  ): Promise<void> {
    const employee = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, status: UserStatus.ACTIVE },
      select: {
        id: true,
        roles: { select: { role: { select: { name: true } } } },
        companyAccess: { where: { companyId }, select: { companyId: true } },
        branchAccess: { where: { branchId }, select: { branchId: true } },
      },
    });
    if (!employee) throw new NotFoundException("Active employee not found");
    const isBusinessAdmin = employee.roles.some((item) =>
      ["BUSINESS_OWNER", "BUSINESS_ADMIN"].includes(item.role.name),
    );
    if (
      !isBusinessAdmin &&
      (!employee.companyAccess.length || !employee.branchAccess.length)
    ) {
      throw new BadRequestException(
        "Employee does not have access to the selected company/branch",
      );
    }
  }

  private async visibleWhere(
    user: AttendanceAuthUser,
    query: ListAttendanceDto,
    selfOnly: boolean,
  ): Promise<Prisma.AttendanceWhereInput> {
    if (query.branchId && !query.companyId) {
      throw new BadRequestException(
        "companyId is required when branchId is provided",
      );
    }
    if (
      query.fromDate &&
      query.toDate &&
      this.dateOnly(query.fromDate) > this.dateOnly(query.toDate)
    ) {
      throw new BadRequestException("fromDate must be on or before toDate");
    }
    if (query.fromDate) this.dateOnly(query.fromDate);
    if (query.toDate) this.dateOnly(query.toDate);

    const manager = this.isManager(user) && !selfOnly;
    if (query.userId && !manager && query.userId !== user.id) {
      throw new ForbiddenException("You can only view your own attendance");
    }

    const where: Prisma.AttendanceWhereInput = {
      tenantId: user.tenantId,
      company: { tenantId: user.tenantId, status: RecordStatus.ACTIVE },
      branch: { status: RecordStatus.ACTIVE },
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(manager && query.userId ? { userId: query.userId } : {}),
      ...(!manager ? { userId: user.id } : {}),
      ...(query.fromDate || query.toDate
        ? {
          attendanceDate: {
            ...(query.fromDate ? { gte: this.dateOnly(query.fromDate) } : {}),
            ...(query.toDate ? { lte: this.dateOnly(query.toDate) } : {}),
          },
        }
        : {}),
    };

    if (!this.isAdmin(user)) {
      const [companies, branches] = await Promise.all([
        this.prisma.userCompanyAccess.findMany({
          where: { userId: user.id },
          select: { companyId: true },
        }),
        this.prisma.userBranchAccess.findMany({
          where: { userId: user.id },
          select: { branchId: true },
        }),
      ]);
      where.companyId = { in: companies.map((item) => item.companyId) };
      where.branchId = { in: branches.map((item) => item.branchId) };
      // Explicit requested IDs must still match the authorized IDs.
      if (
        query.companyId &&
        !companies.some((item) => item.companyId === query.companyId)
      ) {
        throw new ForbiddenException("Company access denied");
      }
      if (
        query.branchId &&
        !branches.some((item) => item.branchId === query.branchId)
      ) {
        throw new ForbiddenException("Branch access denied");
      }
    }
    return where;
  }

  async checkIn(user: AttendanceAuthUser, dto: CheckInDto) {
    await this.ensureScope(user, dto.companyId, dto.branchId);
    await this.ensureEmployee(
      user.tenantId,
      user.id,
      dto.companyId,
      dto.branchId,
    );
    const now = new Date();
    try {
      return await this.prisma.attendance.create({
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
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException(
          "Attendance already recorded for this employee, branch and UTC date",
        );
      }
      throw error;
    }
  }

  async checkOut(user: AttendanceAuthUser, dto: CheckOutDto) {
    await this.ensureScope(user, dto.companyId, dto.branchId);
    const now = new Date();
    const attendance = await this.prisma.attendance.findUnique({
      where: {
        tenantId_companyId_branchId_userId_attendanceDate: {
          tenantId: user.tenantId,
          companyId: dto.companyId,
          branchId: dto.branchId,
          userId: user.id,
          attendanceDate: this.utcToday(now),
        },
      },
    });
    if (!attendance) throw new NotFoundException("No check-in found for today");
    if (
      !attendance.checkInAt ||
      attendance.checkOutAt ||
      attendance.status !== AttendanceStatus.PRESENT
    ) {
      throw new ConflictException("Attendance is not open for check-out");
    }
    const totalMinutes = Math.max(
      0,
      Math.floor((now.getTime() - attendance.checkInAt.getTime()) / 60000),
    );
    const updated = await this.prisma.attendance.updateMany({
      where: {
        id: attendance.id,
        tenantId: user.tenantId,
        status: AttendanceStatus.PRESENT,
        checkInAt: attendance.checkInAt,
        checkOutAt: null,
      },
      data: { checkOutAt: now, totalMinutes },
    });
    if (updated.count !== 1)
      throw new ConflictException("Attendance has already been checked out");
    return this.prisma.attendance.findUniqueOrThrow({
      where: { id: attendance.id },
    });
  }

  async mark(user: AttendanceAuthUser, dto: MarkAttendanceDto) {
    if (!this.isManager(user))
      throw new ForbiddenException(
        "Only managers can mark attendance manually",
      );
    await this.ensureScope(user, dto.companyId, dto.branchId);
    await this.ensureEmployee(
      user.tenantId,
      dto.userId,
      dto.companyId,
      dto.branchId,
    );
    const attendanceDate = this.dateOnly(dto.attendanceDate);
    if (attendanceDate > this.utcToday(new Date())) {
      throw new BadRequestException(
        "Cannot manually mark attendance for a future date",
      );
    }
    try {
      return await this.prisma.attendance.create({
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
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException(
          "Attendance already exists; manual marking will not overwrite it",
        );
      }
      throw error;
    }
  }

  async findAll(
    user: AttendanceAuthUser,
    query: ListAttendanceDto,
    selfOnly = false,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = await this.visibleWhere(user, query, selfOnly);
    const [data, total] = await this.prisma.$transaction([
      this.prisma.attendance.findMany({
        where,
        orderBy: [{ attendanceDate: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.attendance.count({ where }),
    ]);
    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(user: AttendanceAuthUser, id: string) {
    const attendance = await this.prisma.attendance.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!attendance) throw new NotFoundException("Attendance not found");
    await this.ensureScope(user, attendance.companyId, attendance.branchId);
    if (!this.isManager(user) && attendance.userId !== user.id) {
      throw new ForbiddenException("You can only view your own attendance");
    }
    return attendance;
  }
}
