import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  LeaveRequestStatus,
  Prisma,
  RecordStatus,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateLeaveTypeDto } from './dto/create-leave-type.dto';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { AllocateLeaveBalanceDto } from './dto/allocate-leave-balance.dto';
import { ListLeaveRequestsDto } from './dto/list-leave-requests.dto';
import { ListLeaveBalancesDto } from './dto/list-leave-balances.dto';
import { ReviewLeaveDto } from './dto/review-leave.dto';

export interface LeaveAuthUser {
  id: string;
  tenantId: string;
  roles: string[];
}

@Injectable()
export class LeaveService {
  constructor(private readonly prisma: PrismaService) {}

  private isAdmin(user: LeaveAuthUser): boolean {
    return user.roles.some((role) => ['BUSINESS_OWNER', 'BUSINESS_ADMIN'].includes(role));
  }

  private isManager(user: LeaveAuthUser): boolean {
    return this.isAdmin(user) || user.roles.some(role => ['COMPANY_MANAGER', 'BRANCH_MANAGER', 'HR_MANAGER'].includes(role));
  }

  private requireAdmin(user: LeaveAuthUser): void {
    if (!this.isAdmin(user) && !user.roles.includes('HR_MANAGER')) throw new ForbiddenException('Leave administrator access required');
  }

  private requireManager(user: LeaveAuthUser): void {
    if (!this.isManager(user)) throw new ForbiddenException('Manager access required');
  }

  private dateOnly(value: string): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestException('Use YYYY-MM-DD for leave dates');
    }
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
      throw new BadRequestException('Invalid leave calendar date');
    }
    return date;
  }

  private todayUTC(): Date {
    return this.dateOnly(new Date().toISOString().slice(0, 10));
  }

  parseYear(value?: string): number {
    if (value === undefined || value === '') return new Date().getUTCFullYear();
    const year = Number(value);
    if (!/^\d{4}$/.test(value) || !Number.isInteger(year) || year < 2000 || year > 2100) {
      throw new BadRequestException('year must be between 2000 and 2100');
    }
    return year;
  }

  private async ensureCompany(user: LeaveAuthUser, companyId: string): Promise<void> {
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, tenantId: user.tenantId, status: RecordStatus.ACTIVE },
      select: { id: true },
    });
    if (!company) throw new NotFoundException('Active company not found');
    if (this.isAdmin(user)) return;
    const access = await this.prisma.userCompanyAccess.findUnique({
      where: { userId_companyId: { userId: user.id, companyId } },
      select: { userId: true },
    });
    if (!access) throw new ForbiddenException('Company access denied');
  }

  private async ensureScope(user: LeaveAuthUser, companyId: string, branchId: string): Promise<void> {
    const branch = await this.prisma.branch.findFirst({
      where: {
        id: branchId,
        companyId,
        status: RecordStatus.ACTIVE,
        company: { tenantId: user.tenantId, status: RecordStatus.ACTIVE },
      },
      select: { id: true },
    });
    if (!branch) throw new NotFoundException('Active company/branch not found');
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
    if (!companyAccess || !branchAccess) throw new ForbiddenException('Company or branch access denied');
  }

  private async ensureEmployee(tenantId: string, userId: string, companyId: string, branchId: string): Promise<void> {
    const employee = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, status: UserStatus.ACTIVE },
      select: { id: true },
    });
    if (!employee) throw new NotFoundException('Active employee not found');
    const [companyAccess, branchAccess] = await Promise.all([
      this.prisma.userCompanyAccess.findUnique({
        where: { userId_companyId: { userId, companyId } },
        select: { userId: true },
      }),
      this.prisma.userBranchAccess.findUnique({
        where: { userId_branchId: { userId, branchId } },
        select: { userId: true },
      }),
    ]);
    if (!companyAccess || !branchAccess) {
      throw new ForbiddenException('Employee is not assigned to this company and branch');
    }
  }

  private async ensureLeaveType(tenantId: string, companyId: string, leaveTypeId: string) {
    const type = await this.prisma.leaveType.findFirst({
      where: { id: leaveTypeId, tenantId, companyId, status: RecordStatus.ACTIVE },
    });
    if (!type) throw new NotFoundException('Active leave type not found for company');
    return type;
  }

  async createType(user: LeaveAuthUser, dto: CreateLeaveTypeDto) {
    this.requireAdmin(user);
    await this.ensureCompany(user, dto.companyId);
    const code = dto.code.trim().toUpperCase();
    const name = dto.name.trim();
    if (!code || !name) throw new BadRequestException('Leave code and name are required');
    const exists = await this.prisma.leaveType.findUnique({
      where: { companyId_code: { companyId: dto.companyId, code } },
    });
    if (exists) throw new ConflictException('Leave type code already exists in company');
    try {
      return await this.prisma.leaveType.create({
        data: {
          tenantId: user.tenantId,
          companyId: dto.companyId,
          code,
          name,
          isPaid: dto.isPaid ?? true,
          annualAllowance: dto.annualAllowance ?? 0,
        },
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) throw new ConflictException('Leave type code already exists');
      throw error;
    }
  }

  async listTypes(user: LeaveAuthUser, companyId: string) {
    await this.ensureCompany(user, companyId);
    return this.prisma.leaveType.findMany({
      where: { tenantId: user.tenantId, companyId, status: RecordStatus.ACTIVE },
      orderBy: { name: 'asc' },
    });
  }

  async allocate(user: LeaveAuthUser, dto: AllocateLeaveBalanceDto) {
    this.requireAdmin(user);
    await this.ensureScope(user, dto.companyId, dto.branchId);
    await this.ensureEmployee(user.tenantId, dto.userId, dto.companyId, dto.branchId);
    await this.ensureLeaveType(user.tenantId, dto.companyId, dto.leaveTypeId);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const key = { userId: dto.userId, leaveTypeId: dto.leaveTypeId, year: dto.year };
        const existing = await tx.leaveBalance.findUnique({
          where: { userId_leaveTypeId_year: key },
        });
        if (existing && (existing.tenantId !== user.tenantId || existing.companyId !== dto.companyId)) {
          throw new ConflictException('Balance belongs to another company');
        }
        if (existing && dto.allocatedDays < existing.usedDays) {
          throw new ConflictException('Allocation cannot be lower than already approved days');
        }
        return tx.leaveBalance.upsert({
          where: { userId_leaveTypeId_year: key },
          create: {
            tenantId: user.tenantId,
            companyId: dto.companyId,
            userId: dto.userId,
            leaveTypeId: dto.leaveTypeId,
            year: dto.year,
            allocatedDays: dto.allocatedDays,
          },
          update: { allocatedDays: dto.allocatedDays },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      this.rethrowConcurrency(error);
      throw error;
    }
  }

  async getBalances(user: LeaveAuthUser, dto: ListLeaveBalancesDto) {
    await this.ensureScope(user, dto.companyId, dto.branchId);
    if (dto.userId !== user.id) this.requireManager(user);
    await this.ensureEmployee(user.tenantId, dto.userId, dto.companyId, dto.branchId);
    const year = dto.year ?? new Date().getUTCFullYear();
    const balances = await this.prisma.leaveBalance.findMany({
      where: { tenantId: user.tenantId, companyId: dto.companyId, userId: dto.userId, year },
      include: { leaveType: { select: { id: true, code: true, name: true, isPaid: true } } },
      orderBy: { leaveType: { name: 'asc' } },
    });
    return balances.map((balance) => ({
      ...balance,
      remainingDays: balance.allocatedDays - balance.usedDays,
    }));
  }

  async reportingToOptions(user: LeaveAuthUser, companyId: string, branchId: string) {
    await this.ensureScope(user, companyId, branchId);
    const admins = ['BUSINESS_OWNER', 'BUSINESS_ADMIN'];
    const managers = ['COMPANY_MANAGER', 'BRANCH_MANAGER', 'HR_MANAGER'];
    const people = await this.prisma.user.findMany({
      where: {
        tenantId: user.tenantId, status: UserStatus.ACTIVE, id: { not: user.id },
        OR: [
          { roles: { some: { role: { name: { in: admins } } } } },
          {
            roles: { some: { role: { name: { in: managers } } } },
            companyAccess: { some: { companyId } }, branchAccess: { some: { branchId } },
          },
        ],
      },
      select: { id: true, name: true, roles: { select: { role: { select: { name: true } } } } },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    const rank = [...admins, ...managers];
    return people.map(person => ({
      id: person.id, name: person.name,
      position: rank.find(role => person.roles.some(entry => entry.role.name === role))!,
    }));
  }

  async apply(user: LeaveAuthUser, dto: CreateLeaveRequestDto) {
    await this.ensureScope(user, dto.companyId, dto.branchId);
    await this.ensureEmployee(user.tenantId, user.id, dto.companyId, dto.branchId);
    const type = await this.ensureLeaveType(user.tenantId, dto.companyId, dto.leaveTypeId);
    if (dto.reportingToId) {
      const options = await this.reportingToOptions(user, dto.companyId, dto.branchId);
      if (!options.some(person => person.id === dto.reportingToId)) throw new BadRequestException('Choose an active reporting manager for your company and branch');
    }
    const startDate = this.dateOnly(dto.startDate);
    const endDate = this.dateOnly(dto.endDate);
    if (startDate > endDate) throw new BadRequestException('End date must not precede start date');
    if (startDate < this.todayUTC()) throw new BadRequestException('Cannot request leave in the past');
    if (startDate.getUTCFullYear() !== endDate.getUTCFullYear()) {
      throw new BadRequestException('Split cross-year leave into separate requests');
    }
    const days = Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
    if (days > 366) throw new BadRequestException('Leave duration is too long');
    const reason = dto.reason.trim();
    if (!reason) throw new BadRequestException('Leave reason is required');

    try {
      return await this.prisma.$transaction(async (tx) => {
        const overlap = await tx.leaveRequest.count({
          where: {
            tenantId: user.tenantId,
            companyId: dto.companyId,
            userId: user.id,
            status: { in: [LeaveRequestStatus.PENDING, LeaveRequestStatus.APPROVED] },
            startDate: { lte: endDate },
            endDate: { gte: startDate },
          },
        });
        if (overlap) throw new ConflictException('Leave request overlaps another pending or approved request');
        // Balance is checked at approval time. Pending requests do not deduct days.
        return tx.leaveRequest.create({
          data: {
            tenantId: user.tenantId,
            companyId: dto.companyId,
            branchId: dto.branchId,
            userId: user.id,
            leaveTypeId: type.id,
            reportingToId: dto.reportingToId,
            startDate,
            endDate,
            days,
            reason,
          },
          include: { leaveType: { select: { name: true, code: true, isPaid: true } }, reportingTo: { select: { id: true, name: true } } },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      this.rethrowConcurrency(error);
      throw error;
    }
  }

  async listRequests(user: LeaveAuthUser, query: ListLeaveRequestsDto, onlyMine: boolean) {
    const where: Prisma.LeaveRequestWhereInput = { tenantId: user.tenantId };
    if (query.companyId) where.companyId = query.companyId;
    if (query.branchId) where.branchId = query.branchId;
    if (query.status) where.status = query.status;

    if (onlyMine || !this.isManager(user)) {
      where.userId = user.id;
    } else if (this.isAdmin(user)) {
      if (query.userId) where.userId = query.userId;
    } else {
      const [companies, branches] = await Promise.all([
        this.prisma.userCompanyAccess.findMany({
          where: { userId: user.id, company: { tenantId: user.tenantId } },
          select: { companyId: true },
        }),
        this.prisma.userBranchAccess.findMany({
          where: { userId: user.id, branch: { company: { tenantId: user.tenantId } } },
          select: { branchId: true },
        }),
      ]);
      where.AND = [{
        OR: [
          { userId: user.id },
          {
            companyId: { in: companies.map((entry) => entry.companyId) },
            branchId: { in: branches.map((entry) => entry.branchId) },
          },
        ],
      }];
      if (query.userId) where.userId = query.userId;
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const [data, total] = await Promise.all([
      this.prisma.leaveRequest.findMany({
        where,
        include: { leaveType: { select: { code: true, name: true, isPaid: true } }, reportingTo: { select: { id: true, name: true } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.leaveRequest.count({ where }),
    ]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async review(
    user: LeaveAuthUser,
    id: string,
    decision: 'APPROVED' | 'REJECTED',
    dto: ReviewLeaveDto,
  ) {
    this.requireManager(user);
    const original = await this.prisma.leaveRequest.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!original) throw new NotFoundException('Leave request not found');
    await this.ensureScope(user, original.companyId, original.branchId);
    if (original.userId === user.id) {
      throw new ForbiddenException('Managers cannot approve or reject their own leave');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const request = await tx.leaveRequest.findFirst({
          where: { id, tenantId: user.tenantId },
          include: { leaveType: true },
        });
        if (!request) throw new NotFoundException('Leave request not found');
        if (request.status !== LeaveRequestStatus.PENDING) {
          throw new ConflictException('Only pending requests can be reviewed');
        }
        if (decision === 'APPROVED' && request.leaveType.isPaid) {
          const key = {
            userId: request.userId,
            leaveTypeId: request.leaveTypeId,
            year: request.startDate.getUTCFullYear(),
          };
          const balance = await tx.leaveBalance.findUnique({
            where: { userId_leaveTypeId_year: key },
          });
          if (!balance || balance.tenantId !== user.tenantId || balance.companyId !== request.companyId) {
            throw new ConflictException('No leave balance allocated for this employee and year');
          }
          if (balance.allocatedDays - balance.usedDays < request.days) {
            throw new ConflictException('Insufficient remaining leave balance');
          }
          await tx.leaveBalance.update({
            where: { id: balance.id },
            data: { usedDays: { increment: request.days } },
          });
        }
        const changed = await tx.leaveRequest.updateMany({
          where: { id, tenantId: user.tenantId, status: LeaveRequestStatus.PENDING },
          data: {
            status: decision,
            reviewedById: user.id,
            reviewedAt: new Date(),
            reviewNote: dto.note?.trim() || null,
          },
        });
        if (changed.count !== 1) throw new ConflictException('Leave request was already reviewed');
        return tx.leaveRequest.findUniqueOrThrow({ where: { id } });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      this.rethrowConcurrency(error);
      throw error;
    }
  }

  async cancel(user: LeaveAuthUser, id: string) {
    const original = await this.prisma.leaveRequest.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!original) throw new NotFoundException('Leave request not found');
    if (original.userId !== user.id) this.requireManager(user);
    await this.ensureScope(user, original.companyId, original.branchId);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const request = await tx.leaveRequest.findFirst({
          where: { id, tenantId: user.tenantId },
          include: { leaveType: true },
        });
        if (!request) throw new NotFoundException('Leave request not found');
        if (request.status !== LeaveRequestStatus.PENDING && request.status !== LeaveRequestStatus.APPROVED) {
          throw new ConflictException('Only pending or approved leave can be cancelled');
        }
        if (request.status === LeaveRequestStatus.APPROVED && request.startDate <= this.todayUTC()) {
          throw new ConflictException('Approved leave cannot be cancelled on or after its start date');
        }
        if (request.status === LeaveRequestStatus.APPROVED && request.leaveType.isPaid) {
          const key = {
            userId: request.userId,
            leaveTypeId: request.leaveTypeId,
            year: request.startDate.getUTCFullYear(),
          };
          const balance = await tx.leaveBalance.findUnique({
            where: { userId_leaveTypeId_year: key },
          });
          if (!balance || balance.usedDays < request.days) {
            throw new ConflictException('Leave balance is inconsistent; contact administrator');
          }
          await tx.leaveBalance.update({
            where: { id: balance.id },
            data: { usedDays: { decrement: request.days } },
          });
        }
        const changed = await tx.leaveRequest.updateMany({
          where: { id, tenantId: user.tenantId, status: request.status },
          data: { status: LeaveRequestStatus.CANCELLED },
        });
        if (changed.count !== 1) throw new ConflictException('Leave request changed during cancellation');
        return tx.leaveRequest.findUniqueOrThrow({ where: { id } });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      this.rethrowConcurrency(error);
      throw error;
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }

  private rethrowConcurrency(error: unknown): void {
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2034' || error.code === 'P2002')) {
      throw new ConflictException('Concurrent leave update; retry the request');
    }
  }
}
