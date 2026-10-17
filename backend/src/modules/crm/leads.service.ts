import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { LeadStage, Prisma, RecordStatus, UserStatus } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { CreateLeadDto } from "./dto/create-lead.dto";
import { UpdateLeadDto } from "./dto/update-lead.dto";
import { ListLeadsDto } from "./dto/list-leads.dto";

export interface LeadsAuthUser {
  id: string;
  tenantId: string;
  roles: string[];
}

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private isBusinessAdmin(user: LeadsAuthUser): boolean {
    return (
      user.roles.includes("BUSINESS_OWNER") ||
      user.roles.includes("BUSINESS_ADMIN")
    );
  }

  private async checkCompanyAccess(
    user: LeadsAuthUser,
    companyId: string,
  ): Promise<void> {
    const company = await this.prisma.company.findFirst({
      where: {
        id: companyId,
        tenantId: user.tenantId,
        status: RecordStatus.ACTIVE,
      },
    });

    if (!company) {
      throw new NotFoundException("Company not found");
    }

    if (this.isBusinessAdmin(user)) {
      return;
    }

    const access = await this.prisma.userCompanyAccess.findUnique({
      where: {
        userId_companyId: {
          userId: user.id,
          companyId,
        },
      },
    });

    if (!access) {
      throw new ForbiddenException("Company access denied");
    }
  }

  private async checkBranchAccess(
    user: LeadsAuthUser,
    companyId: string,
    branchId: string,
  ): Promise<void> {
    const branch = await this.prisma.branch.findFirst({
      where: {
        id: branchId,
        companyId,
        status: RecordStatus.ACTIVE,
      },
    });

    if (!branch) {
      throw new NotFoundException("Branch not found");
    }

    if (this.isBusinessAdmin(user)) {
      return;
    }

    const access = await this.prisma.userBranchAccess.findUnique({
      where: {
        userId_branchId: {
          userId: user.id,
          branchId,
        },
      },
    });

    if (!access) {
      throw new ForbiddenException("Branch access denied");
    }
  }

  private async checkLeadAccess(user: LeadsAuthUser, leadId: string) {
    const lead = await this.prisma.lead.findFirst({
      where: {
        id: leadId,
        tenantId: user.tenantId,
      },
    });

    if (!lead) {
      throw new NotFoundException("Lead not found");
    }

    await this.checkCompanyAccess(user, lead.companyId);

    if (lead.branchId) {
      await this.checkBranchAccess(user, lead.companyId, lead.branchId);
    } else if (!this.isBusinessAdmin(user)) {
      throw new ForbiddenException(
        "Only business administrators can access company-wide leads",
      );
    }

    return lead;
  }

  private async checkAssignee(
    user: LeadsAuthUser,
    companyId: string,
    branchId: string | null,
    assignedToId: string,
  ): Promise<void> {
    const assignee = await this.prisma.user.findFirst({
      where: {
        id: assignedToId,
        tenantId: user.tenantId,
        status: UserStatus.ACTIVE,
      },
    });

    if (!assignee) {
      throw new NotFoundException("Assigned user not found");
    }

    const assigneeCompanyAccess =
      await this.prisma.userCompanyAccess.findUnique({
        where: {
          userId_companyId: {
            userId: assignedToId,
            companyId,
          },
        },
      });

    const assigneeIsAdmin = await this.prisma.userRole.findFirst({
      where: {
        userId: assignedToId,
        role: {
          name: {
            in: ["BUSINESS_OWNER", "BUSINESS_ADMIN"],
          },
        },
      },
    });

    if (!assigneeCompanyAccess && !assigneeIsAdmin) {
      throw new BadRequestException(
        "Assigned user does not have company access",
      );
    }

    if (branchId && !assigneeIsAdmin) {
      const assigneeBranchAccess =
        await this.prisma.userBranchAccess.findUnique({
          where: {
            userId_branchId: {
              userId: assignedToId,
              branchId,
            },
          },
        });

      if (!assigneeBranchAccess) {
        throw new BadRequestException(
          "Assigned user does not have branch access",
        );
      }
    }
  }

  async create(user: LeadsAuthUser, dto: CreateLeadDto) {
    await this.checkCompanyAccess(user, dto.companyId);

    if (dto.branchId) {
      await this.checkBranchAccess(user, dto.companyId, dto.branchId);
    } else if (!this.isBusinessAdmin(user)) {
      throw new ForbiddenException("Branch is required for non-admin users");
    }

    if (dto.assignedToId) {
      await this.checkAssignee(
        user,
        dto.companyId,
        dto.branchId ?? null,
        dto.assignedToId,
      );
    }

    return this.prisma.lead.create({
      data: {
        tenantId: user.tenantId,
        companyId: dto.companyId,
        branchId: dto.branchId ?? null,
        name: dto.name.trim(),
        email: dto.email?.trim().toLowerCase() ?? null,
        phone: dto.phone?.trim() ?? null,
        address: dto.address?.trim() ?? null,
        notes: dto.notes?.trim() ?? null,
        assignedToId: dto.assignedToId ?? null,
        createdById: user.id,
      },
    });
  }

  async findAll(user: LeadsAuthUser, query: ListLeadsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.LeadWhereInput = {
      tenantId: user.tenantId,
    };

    if (query.companyId) {
      where.companyId = query.companyId;
    }

    if (query.branchId) {
      where.branchId = query.branchId;
    }

    if (query.stage) {
      where.stage = query.stage;
    }

    if (query.assignedToId) {
      where.assignedToId = query.assignedToId;
    }

    if (query.search?.trim()) {
      const search = query.search.trim();

      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ];
    }

    if (!this.isBusinessAdmin(user)) {
      const [companyAccess, branchAccess] = await Promise.all([
        this.prisma.userCompanyAccess.findMany({
          where: { userId: user.id },
          select: { companyId: true },
        }),
        this.prisma.userBranchAccess.findMany({
          where: { userId: user.id },
          select: { branchId: true },
        }),
      ]);

      const companyIds = companyAccess.map((access) => access.companyId);

      const branchIds = branchAccess.map((access) => access.branchId);

      where.AND = [
        {
          companyId: { in: companyIds },
        },
        {
          branchId: { in: branchIds },
        },
      ];
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.lead.findMany({
        where,
        orderBy: {
          createdAt: "desc",
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.lead.count({ where }),
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

  async findOne(user: LeadsAuthUser, id: string) {
    return this.checkLeadAccess(user, id);
  }

  async update(user: LeadsAuthUser, id: string, dto: UpdateLeadDto) {
    const lead = await this.checkLeadAccess(user, id);

    if (lead.stage === LeadStage.WON) {
      throw new ConflictException("Won leads cannot be edited");
    }

    if (dto.branchId !== undefined) {
      if (dto.branchId === null) {
        if (!this.isBusinessAdmin(user)) {
          throw new ForbiddenException(
            "Only administrators can clear the branch",
          );
        }
      } else {
        await this.checkBranchAccess(user, lead.companyId, dto.branchId);
      }

      if (lead.assignedToId) {
        await this.checkAssignee(
          user,
          lead.companyId,
          dto.branchId ?? null,
          lead.assignedToId,
        );
      }
    }

    const data: Prisma.LeadUpdateInput = {};

    if (dto.name !== undefined) {
      data.name = dto.name.trim();
    }

    if (dto.email !== undefined) {
      data.email = dto.email?.trim().toLowerCase() ?? null;
    }

    if (dto.phone !== undefined) {
      data.phone = dto.phone?.trim() ?? null;
    }

    if (dto.address !== undefined) {
      data.address = dto.address?.trim() ?? null;
    }

    if (dto.notes !== undefined) {
      data.notes = dto.notes?.trim() ?? null;
    }

    if (dto.branchId !== undefined) {
      if (dto.branchId === null) {
        data.branch = { disconnect: true };
      } else {
        data.branch = {
          connect: { id: dto.branchId },
        };
      }
    }

    return this.prisma.lead.update({
      where: { id: lead.id },
      data,
    });
  }

  async changeStage(user: LeadsAuthUser, id: string, stage: LeadStage) {
    const lead = await this.checkLeadAccess(user, id);

    // Mark Won must commit the customer conversion rather than merely
    // updating the stage. Keep the response a Lead for existing callers.
    if (stage === LeadStage.WON) {
      await this.convertToCustomer(user, id);
      return this.checkLeadAccess(user, id);
    }

    if (lead.stage === LeadStage.WON) {
      throw new ConflictException("Won leads cannot change stage");
    }

    return this.prisma.lead.update({
      where: { id: lead.id },
      data: { stage },
    });
  }

  async assign(user: LeadsAuthUser, id: string, assignedToId: string | null) {
    const lead = await this.checkLeadAccess(user, id);

    if (lead.stage === LeadStage.WON) {
      throw new ConflictException("Won leads cannot be reassigned");
    }

    if (assignedToId) {
      await this.checkAssignee(
        user,
        lead.companyId,
        lead.branchId,
        assignedToId,
      );
    }

    return this.prisma.lead.update({
      where: { id: lead.id },
      data: {
        assignedToId,
      },
    });
  }

  async convertToCustomer(user: LeadsAuthUser, id: string) {
    const lead = await this.checkLeadAccess(user, id);

    if (lead.convertedCustomerId) {
      const customer = await this.prisma.customer.findFirst({
        where: {
          id: lead.convertedCustomerId,
          tenantId: user.tenantId,
          companyId: lead.companyId,
        },
      });
      if (!customer) {
        throw new ConflictException(
          "Converted customer is unavailable; contact an administrator",
        );
      }
      return {
        message: "Lead was already converted",
        leadId: lead.id,
        customer,
      };
    }

    if (lead.stage === LeadStage.WON) {
      throw new ConflictException(
        "This historical Won lead is not linked to a customer. " +
          "Review its existing customer before attempting conversion.",
      );
    }

    if (
      lead.stage !== LeadStage.QUALIFIED &&
      lead.stage !== LeadStage.PROPOSAL
    ) {
      throw new BadRequestException(
        "Lead must be qualified or in proposal stage before conversion",
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Claim this lead in the transaction. A concurrent attempt will
      // update zero rows and roll back without a duplicate customer.
      const claimed = await tx.lead.updateMany({
        where: {
          id: lead.id,
          tenantId: user.tenantId,
          companyId: lead.companyId,
          stage: lead.stage,
          convertedCustomerId: null,
        },
        data: { stage: LeadStage.WON },
      });

      if (claimed.count !== 1) {
        throw new ConflictException(
          "Lead changed during conversion; refresh and retry",
        );
      }

      const customer = await tx.customer.create({
        data: {
          tenantId: lead.tenantId,
          companyId: lead.companyId,
          branchId: lead.branchId,
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          address: lead.address,
          notes: lead.notes,
          createdById: user.id,
        },
      });

      await tx.lead.update({
        where: { id: lead.id },
        data: { convertedCustomerId: customer.id },
      });
      await this.audit.record(tx, {
        actor: user,
        module: "CRM",
        action: "LEAD_CONVERTED",
        companyId: lead.companyId,
        branchId: lead.branchId ?? undefined,
        targetId: lead.id,
        changes: { customerId: customer.id },
      });

      return {
        message: "Lead converted to customer successfully",
        leadId: lead.id,
        customer,
      };
    });
  }
}
