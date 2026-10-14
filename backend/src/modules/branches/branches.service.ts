
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { CreateBranchDto } from './dto/create-branch.dto';

export type BranchStatus = 'ACTIVE' | 'INACTIVE';

export interface UpdateBranchInput {
  name?: string;
}

export interface BranchActor {
  id: string;
  tenantId: string;
  roles: string[];
}

@Injectable()
export class BranchesService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  private requireAdmin(actor: BranchActor): void {
    if (!actor?.id || !actor?.tenantId) {
      throw new ForbiddenException(
        'Authenticated tenant user required',
      );
    }

    if (
      !actor.roles?.includes('BUSINESS_OWNER') &&
      !actor.roles?.includes('BUSINESS_ADMIN')
    ) {
      throw new ForbiddenException(
        'Business administrator access required',
      );
    }
  }

  private isOwner(actor: BranchActor): boolean {
    return actor.roles.includes('BUSINESS_OWNER');
  }

  private branchScope(
    actor: BranchActor,
  ): Prisma.BranchWhereInput {
    this.requireAdmin(actor);

    return {
      company: {
        tenantId: actor.tenantId,

        ...(!this.isOwner(actor) && {
          userAccess: {
            some: {
              userId: actor.id,
            },
          },
        }),
      },

      ...(!this.isOwner(actor) && {
        userAccess: {
          some: {
            userId: actor.id,
          },
        },
      }),
    };
  }

  private async requireBranch(
    actor: BranchActor,
    branchId: string,
  ) {
    const branch = await this.prisma.branch.findFirst({
      where: {
        AND: [
          this.branchScope(actor),
          { id: branchId },
        ],
      },

      include: {
        company: {
          select: {
            id: true,
            tenantId: true,
            name: true,
            status: true,
          },
        },
      },
    });

    if (!branch) {
      throw new NotFoundException(
        'Branch not found or access denied',
      );
    }

    return branch;
  }

  // =====================================================
  // CREATE BRANCH
  // =====================================================

  async create(
    actor: BranchActor,
    dto: CreateBranchDto,
  ) {
    this.requireAdmin(actor);

    if (
      !dto ||
      typeof dto.name !== 'string' ||
      !dto.name.trim()
    ) {
      throw new BadRequestException(
        'Branch name is required',
      );
    }

    if (
      typeof dto.companyId !== 'string' ||
      !dto.companyId.trim()
    ) {
      throw new BadRequestException(
        'Company ID is required',
      );
    }

    const name = dto.name.trim();
    const companyId = dto.companyId.trim();

    const company = await this.prisma.company.findFirst({
      where: {
        id: companyId,
        tenantId: actor.tenantId,
        status: 'ACTIVE',

        ...(!this.isOwner(actor) && {
          userAccess: {
            some: {
              userId: actor.id,
            },
          },
        }),
      },
    });

    if (!company) {
      throw new NotFoundException(
        'Active company not found or access denied',
      );
    }

    const existing = await this.prisma.branch.findFirst({
      where: {
        companyId,
        name: {
          equals: name,
          mode: 'insensitive',
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        'Branch already exists in this company',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const branch = await tx.branch.create({
        data: {
          companyId,
          name,
          status: 'ACTIVE',
        },
      });

      // Preserve automatic access assignment
      // for whoever creates the branch.

      await tx.userBranchAccess.create({
        data: {
          userId: actor.id,
          branchId: branch.id,
        },
      });

      return branch;
    });
  }

  // =====================================================
  // LIST ACCESSIBLE BRANCHES
  // =====================================================

  async findAll(
    actor: BranchActor,
    companyId?: string,
  ) {
    return this.prisma.branch.findMany({
      where: {
        AND: [
          this.branchScope(actor),

          ...(companyId
            ? [{ companyId }]
            : []),
        ],
      },

      select: {
        id: true,
        companyId: true,
        name: true,
        status: true,

        company: {
          select: {
            id: true,
            name: true,
          },
        },

        createdAt: true,
        updatedAt: true,
      },

      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  // =====================================================
  // GET BRANCH
  // =====================================================

  async findOne(
    actor: BranchActor,
    branchId: string,
  ) {
    const branch = await this.prisma.branch.findFirst({
      where: {
        AND: [
          this.branchScope(actor),
          { id: branchId },
        ],
      },

      select: {
        id: true,
        companyId: true,
        name: true,
        status: true,

        company: {
          select: {
            id: true,
            tenantId: true,
            name: true,
            status: true,
          },
        },

        createdAt: true,
        updatedAt: true,
      },
    });

    if (!branch) {
      throw new NotFoundException(
        'Branch not found or access denied',
      );
    }

    return branch;
  }

  // =====================================================
  // UPDATE BRANCH NAME
  // =====================================================

  async update(
    actor: BranchActor,
    branchId: string,
    dto: UpdateBranchInput,
  ) {
    const branch = await this.requireBranch(
      actor,
      branchId,
    );

    if (
      !dto ||
      typeof dto.name !== 'string' ||
      !dto.name.trim()
    ) {
      throw new BadRequestException(
        'Branch name is required',
      );
    }

    const name = dto.name.trim();

    if (name === branch.name) {
      return this.findOne(actor, branchId);
    }

    const duplicate = await this.prisma.branch.findFirst({
      where: {
        companyId: branch.companyId,
        id: {
          not: branchId,
        },
        name: {
          equals: name,
          mode: 'insensitive',
        },
      },
    });

    if (duplicate) {
      throw new ConflictException(
        'Another branch with this name already exists in this company',
      );
    }

    const result = await this.prisma.branch.updateMany({
      where: {
        AND: [
          this.branchScope(actor),
          { id: branchId },
        ],
      },

      data: {
        name,
      },
    });

    if (result.count !== 1) {
      throw new NotFoundException(
        'Branch not found or access denied',
      );
    }

    return this.findOne(actor, branchId);
  }

  // =====================================================
  // ACTIVATE / DEACTIVATE BRANCH
  // =====================================================

  async updateStatus(
    actor: BranchActor,
    branchId: string,
    status: BranchStatus,
  ) {
    if (
      status !== 'ACTIVE' &&
      status !== 'INACTIVE'
    ) {
      throw new BadRequestException(
        'Status must be ACTIVE or INACTIVE',
      );
    }

    const branch = await this.requireBranch(
      actor,
      branchId,
    );

    if (
      status === 'ACTIVE' &&
      branch.company.status !== 'ACTIVE'
    ) {
      throw new BadRequestException(
        'Cannot activate a branch under an inactive company',
      );
    }

    if (branch.status === status) {
      return this.findOne(actor, branchId);
    }

    const result = await this.prisma.branch.updateMany({
      where: {
        AND: [
          this.branchScope(actor),
          {
            id: branchId,

            ...(status === 'ACTIVE' && {
              company: {
                status: 'ACTIVE',
                tenantId: actor.tenantId,
              },
            }),
          },
        ],
      },

      data: {
        status,
      },
    });

    if (result.count !== 1) {
      throw new BadRequestException(
        'Branch cannot be updated. Check company status and access permissions',
      );
    }

    return this.findOne(actor, branchId);
  }
}
