import * as bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import { OnboardEmployeeDto } from './dto/employee.dto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  EmploymentStatus,
  Prisma,
  RecordStatus,
  UserStatus,
} from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import {
  CreateEmployeeDto,
  ListEmployeesDto,
  UpdateEmployeeDto,
  UpdateEmployeeStatusDto,
} from "./dto/employee.dto";

export interface EmployeeAuthUser {
  id: string;
  tenantId: string;
  roles: string[];
}

const employeeInclude = {
  user: {
    select: { id: true, name: true, email: true, phone: true, status: true },
  },
  company: { select: { id: true, name: true } },
  branch: { select: { id: true, name: true, manager: true } },
} satisfies Prisma.EmployeeProfileInclude;

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private checkSession(actor: EmployeeAuthUser): void {
    if (!actor?.id || !actor.tenantId)
      throw new ForbiddenException("Tenant login required");
  }

  private admin(actor: EmployeeAuthUser): boolean {
    return (actor.roles ?? []).some(
      (r) => r === "BUSINESS_OWNER" || r === "BUSINESS_ADMIN",
    );
  }

  private manager(actor: EmployeeAuthUser): boolean {
    return (actor.roles ?? []).some(role => ['COMPANY_MANAGER', 'BRANCH_MANAGER', 'HR_MANAGER'].includes(role));
  }

  private requireAdmin(actor: EmployeeAuthUser): void {
    this.checkSession(actor);
    if (!this.admin(actor) && !actor.roles.includes("HR_MANAGER"))
      throw new ForbiddenException("Business administrator or HR manager required");
  }

  private requireManager(actor: EmployeeAuthUser): void {
    this.checkSession(actor);
    if (!this.admin(actor) && !actor.roles.includes("HR_MANAGER")) {
      throw new ForbiddenException("Manager or administrator required");
    }
  }

  private parseDate(value: string): Date {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestException("Date must be YYYY-MM-DD");
    }
    const parsed = new Date(value + "T00:00:00.000Z");
    if (
      Number.isNaN(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== value
    ) {
      throw new BadRequestException("Invalid calendar date");
    }
    return parsed;
  }

  private unique(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    );
  }

  private async checkBranch(
    actor: EmployeeAuthUser,
    companyId: string,
    branchId: string,
    managerAllowed = false,
    readerAllowed = false,
  ): Promise<void> {
    this.checkSession(actor);
    const branch = await this.prisma.branch.findFirst({
      where: {
        id: branchId,
        companyId,
        status: RecordStatus.ACTIVE,
        company: { tenantId: actor.tenantId, status: RecordStatus.ACTIVE },
      },
      select: { id: true },
    });
    if (!branch) throw new NotFoundException("Active company/branch not found");
    if (actor.roles.includes('BUSINESS_OWNER')) return;
    if (!this.admin(actor) && (!managerAllowed || !this.manager(actor)) && !(readerAllowed && actor.roles.includes('PAYROLL_MANAGER'))) {
      throw new ForbiddenException("Administrator required");
    }
    const [companyAccess, branchAccess] = await Promise.all([
      this.prisma.userCompanyAccess.findUnique({
        where: { userId_companyId: { userId: actor.id, companyId } },
        select: { userId: true },
      }),
      this.prisma.userBranchAccess.findUnique({
        where: { userId_branchId: { userId: actor.id, branchId } },
        select: { userId: true },
      }),
    ]);
    if (!companyAccess || !branchAccess) {
      throw new ForbiddenException(
        "You are not assigned to this company and branch",
      );
    }
  }

  private async getScoped(actor: EmployeeAuthUser, id: string) {
    this.checkSession(actor);
    const employee = await this.prisma.employeeProfile.findFirst({
      where: { id, tenantId: actor.tenantId },
      include: employeeInclude,
    });
    if (!employee) throw new NotFoundException("Employee not found");
    if (employee.userId === actor.id || actor.roles.includes('BUSINESS_OWNER')) return employee;
    if (!this.admin(actor) && !this.manager(actor) && !actor.roles.includes('PAYROLL_MANAGER'))
      throw new ForbiddenException("Employee access denied");
    await this.checkBranch(actor, employee.companyId, employee.branchId, true, true);
    return employee;
  }

  async create(actor: EmployeeAuthUser, dto: CreateEmployeeDto) {
    this.requireAdmin(actor);
    await this.checkBranch(actor, dto.companyId, dto.branchId, true);
    const user = await this.prisma.user.findFirst({
      where: {
        id: dto.userId,
        tenantId: actor.tenantId,
        status: UserStatus.ACTIVE,
      },
      select: { id: true },
    });
    if (!user)
      throw new NotFoundException("Active user in this tenant not found");
    const code = dto.employeeCode?.trim().toUpperCase();
    if (code !== undefined && !/^[A-Z0-9_-]{2,30}$/.test(code)) {
      throw new BadRequestException(
        "employeeCode must contain 2-30 letters, numbers, _ or -",
      );
    }
    this.parseDate(dto.joiningDate);
    try {
      return await this.prisma.$transaction(async (tx) => {
        return this.createProfile(tx, actor, dto);
      });
    } catch (error) {
      if (this.unique(error)) {
        throw new ConflictException(
          "Employee code or user is already registered for this company",
        );
      }
      throw error;
    }
  }

  private async createProfile(tx: Prisma.TransactionClient, actor: EmployeeAuthUser, dto: CreateEmployeeDto) {
    const code = dto.employeeCode?.trim().toUpperCase();
    const joiningDate = this.parseDate(dto.joiningDate);
    // Serialize settings updates and employee issuance on the company row.
    await tx.$queryRaw`SELECT id FROM "Company" WHERE id = ${dto.companyId} FOR UPDATE`;
    const numbering = await tx.company.findUniqueOrThrow({ where: { id: dto.companyId } });
    let next = numbering.employeeIdNext;
    let assignedCode = code;
    if (!assignedCode) {
      do {
        if (next >= 2000000000) throw new BadRequestException('Employee numbering limit reached');
        assignedCode = numbering.employeeIdPrefix + '-' + String(next++).padStart(numbering.employeeIdDigits, '0');
      } while (await tx.employeeProfile.findUnique({ where: { companyId_employeeCode: { companyId: dto.companyId, employeeCode: assignedCode } } }));
    } else if (assignedCode.startsWith(numbering.employeeIdPrefix + '-')) {
      const suffix = assignedCode.slice(numbering.employeeIdPrefix.length + 1);
      if (/^\d+$/.test(suffix)) {
        const issued = Number(suffix);
        if (issued >= 2000000000) throw new BadRequestException('Employee number exceeds the supported limit');
        next = Math.max(next, issued + 1);
      }
    }
    if (next !== numbering.employeeIdNext) await tx.company.update({ where: { id: dto.companyId }, data: { employeeIdNext: next } });
    // Existing User is reused; these grants are needed by Attendance, Leave and Payroll.
    await tx.userCompanyAccess.upsert({
      where: {
        userId_companyId: { userId: dto.userId, companyId: dto.companyId },
      },
      create: { userId: dto.userId, companyId: dto.companyId },
      update: {},
    });
    await tx.userBranchAccess.upsert({
      where: {
        userId_branchId: { userId: dto.userId, branchId: dto.branchId },
      },
      create: { userId: dto.userId, branchId: dto.branchId },
      update: {},
    });
    const created = await tx.employeeProfile.create({
      data: {
        tenantId: actor.tenantId,
        companyId: dto.companyId,
        branchId: dto.branchId,
        userId: dto.userId,
        employeeCode: assignedCode,
        joiningDate,
        department: dto.department?.trim() || null,
        designation: dto.designation?.trim() || null,
        employmentType: dto.employmentType ?? "FULL_TIME",
        workEmail: dto.workEmail?.trim().toLowerCase() || null,
        notes: dto.notes?.trim() || null,
      },
      include: employeeInclude,
    });
    await this.audit.record(tx, {
      actor,
      companyId: created.companyId,
      branchId: created.branchId,
      module: "EMPLOYEES",
      action: "EMPLOYEE_CREATED",
      targetId: created.id,
      detail: `Employee profile ${created.employeeCode} created`,
      changes: {
        employeeCode: created.employeeCode,
        userId: created.userId,
        status: created.status,
      },
    });
    return created;
  }

  async onboard(actor: EmployeeAuthUser, dto: OnboardEmployeeDto) {
    this.requireAdmin(actor);
    if (!dto.companyId || !dto.branchId || !dto.joiningDate) throw new BadRequestException('Company, branch and joining date are required');
    await this.checkBranch(actor, dto.companyId, dto.branchId, true);
    if (!dto.name?.trim() || !dto.email?.trim() || !dto.joiningDate) throw new BadRequestException('Name, email, branch and joining date are required');
    if (dto.loginEnabled !== false && !dto.password) throw new BadRequestException('A temporary password is required when login is enabled');
    if (dto.status === 'EXITED') throw new BadRequestException('New employees cannot start with exited status');
    const joined = this.parseDate(dto.joiningDate);
    if (dto.gross === undefined || !Number.isFinite(Number(dto.gross)) || Number(dto.gross) <= 0) throw new BadRequestException('Monthly gross salary must be greater than zero');
    const gross = new Prisma.Decimal(dto.gross), deductions = new Prisma.Decimal(dto.deductions ?? '0');
    if (gross.isNegative() || deductions.isNegative() || deductions.greaterThan(gross)) throw new BadRequestException('Deductions cannot exceed gross salary');
    const password = await bcrypt.hash(dto.password ?? randomBytes(32).toString('hex'), 12);
    try {
      return await this.prisma.$transaction(async tx => {
        const role = await tx.role.findUniqueOrThrow({ where: { name: 'EMPLOYEE' } });
        const person = await tx.user.create({ data: {
          tenantId: actor.tenantId, name: dto.name.trim(), email: dto.email.trim().toLowerCase(), password,
          phone: dto.phone || null, status: dto.loginEnabled === false ? 'INACTIVE' : 'ACTIVE',
          roles: { create: { roleId: role.id } },
        } });
        const profile = await this.createProfile(tx, actor, { ...dto, userId: person.id, workEmail: dto.email });
        const updated = await tx.employeeProfile.update({ where: { id: profile.id }, data: {
          status: dto.status ?? 'ACTIVE', bankName: dto.bankName?.trim() || null, bankEnding: dto.bankEnding || null,
          bankIfsc: dto.bankIfsc || null, pan: dto.pan || null, uan: dto.uan || null,
        }, include: employeeInclude });
        if (gross.greaterThan(0)) {
          const structure = await tx.salaryStructure.create({ data: {
            tenantId: actor.tenantId, companyId: dto.companyId, name: 'Monthly salary ' + person.id,
            currency: 'INR', basicAmount: gross,
            components: { create: deductions.greaterThan(0) ? [{ tenantId: actor.tenantId, companyId: dto.companyId, code: 'MONTHLY_DEDUCTION', name: 'Monthly deduction', kind: 'DEDUCTION', amount: deductions }] : [] },
          } });
          await tx.employeeSalary.create({ data: { tenantId: actor.tenantId, companyId: dto.companyId, branchId: dto.branchId, userId: person.id, structureId: structure.id, effectiveFrom: joined } });
        }
        return updated;
      }, { timeout: 15000 });
    } catch (error) {
      if (this.unique(error)) throw new ConflictException('This email or employee is already registered. No onboarding changes were saved.');
      throw error;
    }
  }

  async mine(actor: EmployeeAuthUser) {
    this.checkSession(actor);
    return this.prisma.employeeProfile.findMany({
      where: { tenantId: actor.tenantId, userId: actor.id },
      include: employeeInclude,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    });
  }

  async reportingManagers(actor: EmployeeAuthUser, companyId: string) {
    this.requireAdmin(actor);
    const owner = actor.roles.includes('BUSINESS_OWNER');
    const branches = await this.prisma.branch.findMany({ where: {
      companyId, status: 'ACTIVE', company: { tenantId: actor.tenantId, status: 'ACTIVE', ...(!owner ? { userAccess: { some: { userId: actor.id } } } : {}) },
      ...(!owner ? { userAccess: { some: { userId: actor.id } } } : {}),
    }, select: { id: true } });
    if (!branches.length) throw new ForbiddenException('No assigned branches in this company');
    return this.prisma.user.findMany({
      where: { tenantId: actor.tenantId, status: 'ACTIVE', roles: { some: { role: { name: { in: ['BUSINESS_OWNER', 'BUSINESS_ADMIN', 'COMPANY_MANAGER', 'BRANCH_MANAGER', 'HR_MANAGER', 'PAYROLL_MANAGER', 'SALES_MANAGER'] } } } },
        OR: [{ roles: { some: { role: { name: 'BUSINESS_OWNER' } } } }, { companyAccess: { some: { companyId } }, branchAccess: { some: { branchId: { in: branches.map(row => row.id) } } } }] },
      select: { id: true, name: true, email: true, status: true, createdAt: true,
        roles: { select: { role: { select: { id: true, name: true } } } },
        companyAccess: { where: { companyId }, select: { company: { select: { id: true, name: true } } } },
        branchAccess: { where: { branchId: { in: branches.map(row => row.id) } }, select: { branch: { select: { id: true, name: true } } } },
      }, orderBy: { name: 'asc' },
    });
  }

  async list(actor: EmployeeAuthUser, query: ListEmployeesDto) {
    this.checkSession(actor);
    if (!this.admin(actor) && !this.manager(actor) && !actor.roles.includes('PAYROLL_MANAGER')) throw new ForbiddenException('Employee directory access required');
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 20);
    if (
      !Number.isInteger(page) ||
      page < 1 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100
    ) {
      throw new BadRequestException(
        "page must be >= 1 and limit must be 1-100",
      );
    }
    if (query.branchId && !query.companyId) {
      throw new BadRequestException(
        "companyId is required when branchId is provided",
      );
    }
    if (query.companyId) {
      const company = await this.prisma.company.findFirst({
        where: { id: query.companyId, tenantId: actor.tenantId },
        select: { id: true },
      });
      if (!company) throw new NotFoundException("Company not found");
    }
    if (query.branchId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: query.branchId, companyId: query.companyId },
        select: { id: true },
      });
      if (!branch) throw new NotFoundException("Branch not found in company");
    }
    const where: Prisma.EmployeeProfileWhereInput = {
      tenantId: actor.tenantId,
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    if (!actor.roles.includes('BUSINESS_OWNER')) {
      where.company = { userAccess: { some: { userId: actor.id } } };
      where.branch = { userAccess: { some: { userId: actor.id } } };
    }
    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { employeeCode: { contains: search, mode: "insensitive" } },
        { department: { contains: search, mode: "insensitive" } },
        { designation: { contains: search, mode: "insensitive" } },
        { user: { name: { contains: search, mode: "insensitive" } } },
        { user: { email: { contains: search, mode: "insensitive" } } },
      ];
    }
    const [items, total] = await this.prisma.$transaction([
      this.prisma.employeeProfile.findMany({
        where,
        include: employeeInclude,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.employeeProfile.count({ where }),
    ]);
    return {
      items,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async get(actor: EmployeeAuthUser, id: string) {
    return this.getScoped(actor, id);
  }

  async update(actor: EmployeeAuthUser, id: string, dto: UpdateEmployeeDto) {
    this.requireManager(actor);
    const employee = await this.getScoped(actor, id);
    await this.checkBranch(actor, employee.companyId, employee.branchId, true);
    if (dto.branchId && dto.branchId !== employee.branchId) {
      await this.checkBranch(actor, employee.companyId, dto.branchId, true);
    }
    const joiningDate = dto.joiningDate
      ? this.parseDate(dto.joiningDate)
      : employee.joiningDate;
    if (employee.exitDate && joiningDate > employee.exitDate) {
      throw new BadRequestException("joiningDate cannot be after exitDate");
    }
    const data: Prisma.EmployeeProfileUpdateInput = {
      ...Object.fromEntries(['bankName', 'bankEnding', 'bankIfsc', 'pan', 'uan'].filter(key => dto[key as keyof UpdateEmployeeDto] !== undefined).map(key => [key, String(dto[key as keyof UpdateEmployeeDto] ?? '').trim() || null])),
      ...(dto.department !== undefined
        ? { department: dto.department.trim() || null }
        : {}),
      ...(dto.designation !== undefined
        ? { designation: dto.designation.trim() || null }
        : {}),
      ...(dto.employmentType !== undefined
        ? { employmentType: dto.employmentType }
        : {}),
      ...(dto.workEmail !== undefined
        ? { workEmail: dto.workEmail.trim().toLowerCase() || null }
        : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes.trim() || null } : {}),
      ...(dto.joiningDate !== undefined ? { joiningDate } : {}),
      ...(dto.branchId && dto.branchId !== employee.branchId
        ? { branch: { connect: { id: dto.branchId } } }
        : {}),
    };
    if (Object.keys(data).length === 0)
      throw new BadRequestException("No changes supplied");
    return this.prisma.$transaction(async (tx) => {
      if (dto.branchId && dto.branchId !== employee.branchId) {
        await tx.userBranchAccess.upsert({
          where: {
            userId_branchId: {
              userId: employee.userId,
              branchId: dto.branchId,
            },
          },
          create: { userId: employee.userId, branchId: dto.branchId },
          update: {},
        });
      }
      const updated = await tx.employeeProfile.update({
        where: { id },
        data,
        include: employeeInclude,
      });
      const changedFields = Object.keys(dto).filter(
        (field) => field !== "branchId" && field in data,
      );
      if (changedFields.length > 0) {
        await this.audit.record(tx, {
          actor,
          companyId: employee.companyId,
          branchId: employee.branchId,
          module: "EMPLOYEES",
          action: "EMPLOYEE_UPDATED",
          targetId: id,
          detail: `Employee profile ${employee.employeeCode} updated`,
          changes: { fields: changedFields },
        });
      }
      if (updated.branchId !== employee.branchId) {
        await this.audit.record(tx, {
          actor,
          companyId: employee.companyId,
          branchId: updated.branchId,
          module: "EMPLOYEES",
          action: "EMPLOYEE_BRANCH_CHANGED",
          targetId: id,
          detail: `Employee ${employee.employeeCode} moved to another branch`,
          changes: {
            fromBranchId: employee.branchId,
            toBranchId: updated.branchId,
          },
        });
      }
      return updated;
    });
  }

  async changeStatus(
    actor: EmployeeAuthUser,
    id: string,
    dto: UpdateEmployeeStatusDto,
  ) {
    this.requireAdmin(actor);
    const employee = await this.getScoped(actor, id);
    if (!Object.values(EmploymentStatus).includes(dto.status)) {
      throw new BadRequestException("Invalid employment status");
    }
    let exitDate: Date | null = employee.exitDate;
    if (dto.status === EmploymentStatus.EXITED) {
      if (!dto.exitDate && !exitDate)
        throw new BadRequestException("exitDate is required when exiting");
      if (dto.exitDate) exitDate = this.parseDate(dto.exitDate);
      if (exitDate && exitDate < employee.joiningDate) {
        throw new BadRequestException("exitDate cannot be before joiningDate");
      }
    } else if (dto.exitDate) {
      throw new BadRequestException(
        "exitDate is only accepted when status is EXITED",
      );
    } else if (
      employee.status === EmploymentStatus.EXITED &&
      dto.status === EmploymentStatus.ACTIVE
    ) {
      throw new ConflictException(
        "Reactivation requires a reviewed rehire workflow",
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.employeeProfile.update({
        where: { id },
        data: {
          status: dto.status,
          ...(dto.status === EmploymentStatus.EXITED ? { exitDate } : {}),
        },
        include: employeeInclude,
      });
      if (
        employee.status !== updated.status ||
        employee.exitDate?.getTime() !== updated.exitDate?.getTime()
      ) {
        await this.audit.record(tx, {
          actor,
          companyId: employee.companyId,
          branchId: employee.branchId,
          module: "EMPLOYEES",
          action: "EMPLOYEE_STATUS_CHANGED",
          targetId: id,
          detail: `Employee ${employee.employeeCode} employment status changed`,
          changes: {
            from: employee.status,
            to: updated.status,
            exitDate: updated.exitDate?.toISOString().slice(0, 10) ?? null,
          },
        });
      }
      return updated;
    });
  }
}
