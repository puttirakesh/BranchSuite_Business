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
