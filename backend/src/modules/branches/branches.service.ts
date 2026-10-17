import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, RecordStatus, EmploymentStatus } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateBranchDto } from "./dto/create-branch.dto";
import { UpdateBranchDto } from "./dto/update-branch.dto";

export type BranchStatus = "ACTIVE" | "INACTIVE";
export interface BranchActor {
  id: string;
  tenantId: string;
  roles: string[];
}

@Injectable()
export class BranchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private requireAdmin(actor: BranchActor): void {
    if (
      !actor?.id ||
      !actor?.tenantId ||
      !actor.roles?.some((role) =>
        ["BUSINESS_ADMIN", "BUSINESS_OWNER"].includes(role),
      )
    ) {
      throw new ForbiddenException("Business administrator access required");
    }
  }

  private owner(actor: BranchActor): boolean {
    return actor.roles.includes("BUSINESS_OWNER");
  }

  private scoped(actor: BranchActor): Prisma.BranchWhereInput {
    this.requireAdmin(actor);
    return {
      company: {
        tenantId: actor.tenantId,
        ...(!this.owner(actor)
          ? { userAccess: { some: { userId: actor.id } } }
          : {}),
      },
      ...(!this.owner(actor)
        ? { userAccess: { some: { userId: actor.id } } }
        : {}),
    };
  }

  private async requireBranch(actor: BranchActor, id: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { AND: [this.scoped(actor), { id }] },
      include: { company: { select: { status: true, tenantId: true } } },
    });
    if (!branch)
      throw new NotFoundException("Branch not found or access denied");
    return branch;
  }

  private cleanName(value: unknown): string {
    if (
      typeof value !== "string" ||
      !value.trim() ||
      value.trim().length > 150
    ) {
      throw new BadRequestException(
        "Branch name must contain 1 to 150 characters",
      );
    }
    return value.trim();
  }
  private cleanCode(value: unknown): string {
    if (
      typeof value !== "string" ||
      !/^[A-Za-z0-9_-]{2,20}$/.test(value.trim())
    ) {
      throw new BadRequestException(
        "Branch code must contain 2-20 letters, digits, underscores or hyphens",
      );
    }
    return value.trim().toUpperCase();
  }
  private cleanOptional(value: unknown, field: string, max: number): string {
    if (value === undefined || value === null) return "";
    if (typeof value !== "string" || value.trim().length > max) {
      throw new BadRequestException(
        `${field} must be a string of at most ${max} characters`,
      );
    }
    return value.trim();
  }

  private isUnique(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    );
  }
  private async companyAccessible(actor: BranchActor, companyId: string) {
    this.requireAdmin(actor);
    const company = await this.prisma.company.findFirst({
      where: {
        id: companyId,
        tenantId: actor.tenantId,
        status: RecordStatus.ACTIVE,
        ...(!this.owner(actor)
          ? { userAccess: { some: { userId: actor.id } } }
          : {}),
      },
      select: { id: true },
    });
    if (!company)
      throw new NotFoundException("Active company not found or access denied");
  }

  private selection = {
    id: true,
    companyId: true,
    name: true,
    code: true,
    location: true,
    manager: true,
    status: true,
    createdAt: true,
    updatedAt: true,
    _count: {
      select: {
        employeeProfiles: { where: { status: EmploymentStatus.ACTIVE } },
      },
    },
  } as const;

  private toDto(row: {
    _count: { employeeProfiles: number };
    [key: string]: unknown;
  }) {
    const { _count, ...rest } = row;
    return { ...rest, employees: _count.employeeProfiles };
  }

  async create(actor: BranchActor, dto: CreateBranchDto) {
    if (!dto?.companyId)
      throw new BadRequestException("Company ID is required");
    await this.companyAccessible(actor, dto.companyId);
    const name = this.cleanName(dto.name);
    const code = dto.code
      ? this.cleanCode(dto.code)
      : `BR${randomBytes(6).toString("hex").toUpperCase()}`;
    const location = this.cleanOptional(dto.location, "Location", 240);
    const manager = this.cleanOptional(dto.manager, "Manager", 150);

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const branch = await tx.branch.create({
          data: {
            companyId: dto.companyId,
            name,
            code,
            location,
            manager,
            status: RecordStatus.ACTIVE,
          },
        });
        await tx.userBranchAccess.create({
          data: { userId: actor.id, branchId: branch.id },
        });
        await this.audit.record(tx, {
          actor,
          companyId: dto.companyId,
          branchId: branch.id,
          module: "BRANCHES",
          action: "BRANCH_CREATED",
          targetId: branch.id,
          detail: `Branch ${name} created`,
          changes: { name, code, location, manager, status: "ACTIVE" },
        });
        return branch;
      });
      return this.findOne(actor, created.id);
    } catch (error) {
      if (this.isUnique(error))
        throw new ConflictException(
          "Branch name or code already exists in this company",
        );
      throw error;
    }
  }

  async findAll(actor: BranchActor, companyId?: string) {
    if (
      companyId !== undefined &&
      !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(companyId)
    ) {
      throw new BadRequestException("Invalid company ID");
    }
    const rows = await this.prisma.branch.findMany({
      where: {
        AND: [this.scoped(actor), ...(companyId ? [{ companyId }] : [])],
      },
      select: this.selection,
      orderBy: [{ name: "asc" }, { createdAt: "asc" }],
    });
    return rows.map((row) => this.toDto(row));
  }

  async findOne(actor: BranchActor, id: string) {
    const row = await this.prisma.branch.findFirst({
      where: { AND: [this.scoped(actor), { id }] },
      select: this.selection,
    });
    if (!row) throw new NotFoundException("Branch not found or access denied");
    return this.toDto(row);
  }

  async update(actor: BranchActor, id: string, dto: UpdateBranchDto) {
    const branch = await this.requireBranch(actor, id);
    if (
      !dto ||
      !Object.keys(dto).some((key) =>
        ["name", "code", "location", "manager"].includes(key),
      )
    ) {
      throw new BadRequestException(
        "Provide at least one branch field to update",
      );
    }
    const data: Prisma.BranchUpdateManyMutationInput = {};
    if (dto.name !== undefined) data.name = this.cleanName(dto.name);
    if (dto.code !== undefined) data.code = this.cleanCode(dto.code);
    if (dto.location !== undefined)
      data.location = this.cleanOptional(dto.location, "Location", 240);
    if (dto.manager !== undefined)
      data.manager = this.cleanOptional(dto.manager, "Manager", 150);
    try {
      await this.prisma.$transaction(async (tx) => {
        const result = await tx.branch.updateMany({
          where: {
            AND: [this.scoped(actor), { id, companyId: branch.companyId }],
          },
          data,
        });
        if (result.count !== 1)
          throw new NotFoundException("Branch not found or access denied");
        await this.audit.record(tx, {
          actor,
          companyId: branch.companyId,
          branchId: id,
          module: "BRANCHES",
          action: "BRANCH_UPDATED",
          targetId: id,
          detail: `Updated branch ${branch.name}`,
          changes: {
            before: {
              name: branch.name,
              code: branch.code,
              location: branch.location,
              manager: branch.manager,
            },
            after: {
              name: dto.name ?? branch.name,
              code: dto.code ?? branch.code,
              location: dto.location ?? branch.location,
              manager: dto.manager ?? branch.manager,
            },
          },
        });
      });
      return this.findOne(actor, id);
    } catch (error) {
      if (this.isUnique(error))
        throw new ConflictException(
          "Branch name or code already exists in this company",
        );
      throw error;
    }
  }

  async updateStatus(actor: BranchActor, id: string, status: BranchStatus) {
    if (status !== "ACTIVE" && status !== "INACTIVE")
      throw new BadRequestException("Invalid branch status");
    const branch = await this.requireBranch(actor, id);
    if (branch.status === status) return this.findOne(actor, id);
    if (status === "ACTIVE" && branch.company.status !== RecordStatus.ACTIVE) {
      throw new ConflictException(
        "Cannot activate a branch under an inactive company",
      );
    }
    // Refuse inactivation while active employees belong to this branch.
    // This is safer than silently disabling attendance, payroll and employee access.
    if (status === "INACTIVE") {
      const active = await this.prisma.employeeProfile.count({
        where: {
          branchId: id,
          companyId: branch.companyId,
          status: EmploymentStatus.ACTIVE,
        },
      });
      if (active > 0)
        throw new ConflictException(
          "Reassign or deactivate active employees before inactivating this branch",
        );
    }
    await this.prisma.$transaction(async (tx) => {
      const result = await tx.branch.updateMany({
        where: {
          AND: [
            this.scoped(actor),
            { id, companyId: branch.companyId, status: branch.status },
          ],
        },
        data: { status },
      });
      if (result.count !== 1)
        throw new ConflictException("Branch status changed; refresh and retry");
      await this.audit.record(tx, {
        actor,
        companyId: branch.companyId,
        branchId: id,
        module: "BRANCHES",
        action: "BRANCH_STATUS_CHANGED",
        targetId: id,
        detail: `${branch.name}: ${branch.status} to ${status}`,
        changes: { before: { status: branch.status }, after: { status } },
      });
    });
    return this.findOne(actor, id);
  }
}
