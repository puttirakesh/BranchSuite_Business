import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { Prisma } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { CreateCompanyDto } from "./dto/create-company.dto";
import { PayslipSettingsDto, PayrollCalendarDto } from './dto/company-payroll-settings.dto';

export type CompanyStatus = "ACTIVE" | "INACTIVE";

export interface UpdateCompanyInput {
  name?: string;
}

export interface CompanyActor {
  id: string;
  tenantId: string;
  roles: string[];
}

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  async savePayslipSettings(actor: CompanyActor, companyId: string, input: PayslipSettingsDto) {
    await this.requireCompany(actor, companyId);
    if (input.logoDataUrl) {
      const bytes = Buffer.from(input.logoDataUrl.split(',')[1], 'base64');
      const valid = input.logoDataUrl.startsWith('data:image/png;') ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
      if (!valid) throw new BadRequestException('Upload a valid PNG or JPEG logo.');
    }
    const { version, ...settings } = input;
    return this.prisma.$transaction(async tx => {
      const saved = await tx.company.updateMany({ where: { id: companyId, payslipSettingsVersion: version }, data: { payslipSettings: settings, payslipSettingsVersion: { increment: 1 } } });
      if (!saved.count) throw new ConflictException('Payslip settings changed. Refresh and retry.');
      await tx.auditEvent.create({ data: { tenantId: actor.tenantId, companyId, actorId: actor.id, module: 'PAYROLL', action: 'PAYSLIP_SETTINGS_CHANGED', targetId: companyId, detail: 'Company payslip settings revised' } });
      return tx.company.findUniqueOrThrow({ where: { id: companyId } });
    });
  }

  async savePayrollCalendar(actor: CompanyActor, companyId: string, input: PayrollCalendarDto) {
    await this.requireCompany(actor, companyId);
    for (const value of input.holidays) {
      const parsed = new Date(value + 'T00:00:00Z');
      if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new BadRequestException('Holiday dates must be valid calendar dates.');
    }
    return this.prisma.$transaction(async tx => {
      const saved = await tx.company.update({ where: { id: companyId }, data: { payrollCalendar: { weeklyOffDays: input.weeklyOffDays, holidays: input.holidays } } });
      await tx.auditEvent.create({ data: { tenantId: actor.tenantId, companyId, actorId: actor.id, module: 'PAYROLL', action: 'PAYROLL_CALENDAR_CHANGED', targetId: companyId, detail: 'Company weekly offs and holidays changed' } });
      return saved;
    });
  }

  private requireAdmin(actor: CompanyActor): void {
    if (!actor?.id || !actor?.tenantId) {
      throw new ForbiddenException("Authenticated tenant user required");
    }

    if (
      !actor.roles?.includes("BUSINESS_OWNER") &&
      !actor.roles?.includes("BUSINESS_ADMIN")
    ) {
      throw new ForbiddenException("Business administrator access required");
    }
  }

  private isOwner(actor: CompanyActor): boolean {
    return actor.roles.includes("BUSINESS_OWNER");
  }

  private companyScope(actor: CompanyActor): Prisma.CompanyWhereInput {
    this.requireAdmin(actor);

    return {
      tenantId: actor.tenantId,

      ...(!this.isOwner(actor) && {
        userAccess: {
          some: {
            userId: actor.id,
          },
        },
      }),
    };
  }

  private async requireCompany(actor: CompanyActor, companyId: string) {
    const company = await this.prisma.company.findFirst({
      where: {
        AND: [this.companyScope(actor), { id: companyId }],
      },
    });

    if (!company) {
      throw new NotFoundException("Company not found or access denied");
    }

    return company;
  }

  async updateEmployeeNumbering(actor: CompanyActor, companyId: string, input: { prefix?: unknown; digits?: unknown; nextNumber?: unknown }) {
    await this.requireCompany(actor, companyId);
    const prefix = typeof input?.prefix === 'string' ? input.prefix.trim().toUpperCase() : '';
    const digits = input?.digits;
    const nextNumber = input?.nextNumber;
    if (!/^[A-Z][A-Z0-9]{0,11}$/.test(prefix) || !Number.isInteger(digits) || Number(digits) < 1 || Number(digits) > 8 || !Number.isInteger(nextNumber) || Number(nextNumber) < 1 || Number(nextNumber) >= 2000000000)
      throw new BadRequestException('Use a 1-12 character prefix starting with a letter, 1-8 digits, and a positive next number below 2000000000');
    return this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Company" WHERE id = ${companyId} FOR UPDATE`;
      const current = await tx.company.findUniqueOrThrow({ where: { id: companyId } });
      if (Number(nextNumber) < current.employeeIdNext) throw new BadRequestException('Next number cannot be lower than the current sequence. Reload settings.');
      const updated = await tx.company.update({ where: { id: companyId }, data: { employeeIdPrefix: prefix, employeeIdDigits: Number(digits), employeeIdNext: Number(nextNumber) } });
      await tx.auditEvent.create({ data: { tenantId: actor.tenantId, companyId, actorId: actor.id, module: 'WORKSPACE', action: 'EMPLOYEE_NUMBERING_CHANGED', targetId: companyId, detail: 'Employee numbering settings changed', changes: { prefix, digits: Number(digits), nextNumber: Number(nextNumber) } } });
      return updated;
    });
  }

  // =====================================================
  // CREATE COMPANY
  // =====================================================

  async create(actor: CompanyActor, dto: CreateCompanyDto) {
    this.requireAdmin(actor);

    const name = dto?.name?.trim();

    if (!name) {
      throw new BadRequestException("Company name is required");
    }

    // Company creation is permitted for Business Owners.
    // Existing-company access does not grant a Business
    // Admin permission to create arbitrary new companies.

    if (!this.isOwner(actor)) {
      throw new ForbiddenException(
        "Only a Business Owner can create companies",
      );
    }

    const existing = await this.prisma.company.findFirst({
      where: {
        tenantId: actor.tenantId,
        name: {
          equals: name,
          mode: "insensitive",
        },
      },
    });

    if (existing) {
      throw new ConflictException("Company already exists in this tenant");
    }

    return this.prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          tenantId: actor.tenantId,
          name,
          status: "ACTIVE",
        },
      });

      await tx.userCompanyAccess.create({
        data: {
          userId: actor.id,
          companyId: company.id,
        },
      });

      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          companyId: company.id,
          actorId: actor.id,
          module: "WORKSPACE",
          action: "COMPANY_CREATED",
          targetId: company.id,
          detail: "Company created",
          changes: { name: company.name },
        },
      });
      return company;
    });
  }

  // =====================================================
  // LIST COMPANIES
  // =====================================================

  async findAll(actor: CompanyActor) {
    return this.prisma.company.findMany({
      where: this.companyScope(actor),

      select: {
        id: true,
          employeeIdPrefix: true, employeeIdDigits: true, employeeIdNext: true,
          payslipSettings: true, payslipSettingsVersion: true, payrollCalendar: true,
        tenantId: true,
        name: true,
        status: true,

        branches: {
          select: {
            id: true,
            name: true,
            status: true,
          },
          orderBy: {
            createdAt: "asc",
          },
        },

        createdAt: true,
        updatedAt: true,
      },

      orderBy: {
        createdAt: "asc",
      },
    });
  }

  // =====================================================
  // GET COMPANY
  // =====================================================

  async findOne(actor: CompanyActor, companyId: string) {
    const company = await this.prisma.company.findFirst({
      where: {
        AND: [this.companyScope(actor), { id: companyId }],
      },

      select: {
        id: true,
          employeeIdPrefix: true, employeeIdDigits: true, employeeIdNext: true,
          payslipSettings: true, payslipSettingsVersion: true, payrollCalendar: true,
        tenantId: true,
        name: true,
        status: true,

        branches: {
          select: {
            id: true,
            name: true,
            status: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: {
            createdAt: "asc",
          },
        },

        createdAt: true,
        updatedAt: true,
      },
    });

    if (!company) {
      throw new NotFoundException("Company not found or access denied");
    }

    return company;
  }

  // =====================================================
  // UPDATE COMPANY NAME
  // =====================================================

  async update(
    actor: CompanyActor,
    companyId: string,
    dto: UpdateCompanyInput,
  ) {
    const company = await this.requireCompany(actor, companyId);

    if (!dto || typeof dto.name !== "string" || !dto.name.trim()) {
      throw new BadRequestException("Company name is required");
    }

    const name = dto.name.trim();

    if (name === company.name) {
      return this.findOne(actor, companyId);
    }

    const duplicate = await this.prisma.company.findFirst({
      where: {
        tenantId: actor.tenantId,
        id: {
          not: companyId,
        },
        name: {
          equals: name,
          mode: "insensitive",
        },
      },
    });

    if (duplicate) {
      throw new ConflictException(
        "Another company with this name already exists",
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.company.updateMany({
        where: { AND: [this.companyScope(actor), { id: companyId }] },
        data: { name },
      });
      if (updated.count === 1)
        await tx.auditEvent.create({
          data: {
            tenantId: actor.tenantId,
            companyId,
            actorId: actor.id,
            module: "WORKSPACE",
            action: "COMPANY_RENAMED",
            targetId: companyId,
            detail: "Company name changed",
            changes: { from: company.name, to: name },
          },
        });
      return updated;
    });

    if (result.count !== 1) {
      throw new NotFoundException("Company not found or access denied");
    }

    return this.findOne(actor, companyId);
  }

  // =====================================================
  // UPDATE COMPANY STATUS
  // =====================================================

  async updateStatus(
    actor: CompanyActor,
    companyId: string,
    status: CompanyStatus,
  ) {
    if (status !== "ACTIVE" && status !== "INACTIVE") {
      throw new BadRequestException("Invalid company status");
    }

    const company = await this.requireCompany(actor, companyId);

    if (company.status === status) {
      return this.findOne(actor, companyId);
    }

    if (status === "INACTIVE") {
      const activeBranchCount = await this.prisma.branch.count({
        where: {
          companyId,
          company: {
            tenantId: actor.tenantId,
          },
          status: "ACTIVE",
        },
      });

      if (activeBranchCount > 0) {
        throw new BadRequestException(
          "Deactivate all active branches before deactivating this company",
        );
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.company.updateMany({
        where: { AND: [this.companyScope(actor), { id: companyId }] },
        data: { status },
      });
      if (updated.count === 1)
        await tx.auditEvent.create({
          data: {
            tenantId: actor.tenantId,
            companyId,
            actorId: actor.id,
            module: "WORKSPACE",
            action: "COMPANY_STATUS_CHANGED",
            targetId: companyId,
            detail: "Company status changed",
            changes: { from: company.status, to: status },
          },
        });
      return updated;
    });

    if (result.count !== 1) {
      throw new NotFoundException("Company not found or access denied");
    }

    return this.findOne(actor, companyId);
  }
}
