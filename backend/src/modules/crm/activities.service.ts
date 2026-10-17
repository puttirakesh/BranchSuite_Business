
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  ActivityStatus,
  Prisma,
  RecordStatus,
  UserStatus,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

import { CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';
import { ListActivitiesDto } from './dto/list-activities.dto';

export interface ActivitiesAuthUser {
  id: string;
  tenantId: string;
  roles: string[];
}

@Injectable()
export class ActivitiesService {
  constructor(private readonly prisma: PrismaService) {}

  private isBusinessAdmin(user: ActivitiesAuthUser): boolean {
    return user.roles.some((role) =>
      ['BUSINESS_OWNER', 'BUSINESS_ADMIN'].includes(role),
    );
  }

  private async checkCompanyAccess(
    user: ActivitiesAuthUser,
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
      throw new NotFoundException('Company not found');
    }

    if (this.isBusinessAdmin(user)) {
      return;
    }

    const access = await this.prisma.userCompanyAccess.findFirst({
      where: {
        userId: user.id,
        companyId,
      },
    });

    if (!access) {
      throw new ForbiddenException('Company access denied');
    }
  }


private async checkBranchAccess(
  user: ActivitiesAuthUser,
  companyId: string,
  branchId: string,
): Promise<void> {
  const branch = await this.prisma.branch.findFirst({
    where: {
      id: branchId,
      companyId,
      company: {
        tenantId: user.tenantId,
      },
      status: RecordStatus.ACTIVE,
    },
  });

  if (!branch) {
    throw new NotFoundException('Branch not found');
  }

  if (this.isBusinessAdmin(user)) {
    return;
  }

  const access = await this.prisma.userBranchAccess.findFirst({
    where: {
      userId: user.id,
      branchId,
    },
  });

  if (!access) {
    throw new ForbiddenException('Branch access denied');
  }
}


  private async checkActivityAccess(
    user: ActivitiesAuthUser,
    id: string,
  ) {
    const activity = await this.prisma.crmActivity.findFirst({
      where: {
        id,
        tenantId: user.tenantId,
      },
    });

    if (!activity) {
      throw new NotFoundException('Activity not found');
    }

    await this.checkCompanyAccess(user, activity.companyId);

    if (activity.branchId) {
      await this.checkBranchAccess(
        user,
        activity.companyId,
        activity.branchId,
      );
    } else if (!this.isBusinessAdmin(user)) {
      throw new ForbiddenException(
        'Company-wide activities require business administrator access',
      );
    }

    return activity;
  }

  private async checkRelatedRecord(
    user: ActivitiesAuthUser,
    dto: CreateActivityDto,
  ): Promise<void> {
    const hasLead = dto.leadId != null;
    const hasCustomer = dto.customerId != null;

    if (hasLead === hasCustomer) {
      throw new BadRequestException(
        'Provide exactly one of leadId or customerId',
      );
    }

    if (dto.leadId) {
      const lead = await this.prisma.lead.findFirst({
        where: {
          id: dto.leadId,
          tenantId: user.tenantId,
          companyId: dto.companyId,
          branchId: dto.branchId ?? null,
        },
      });

      if (!lead) {
        throw new NotFoundException(
          'Lead not found in the selected company and branch',
        );
      }
    }

    if (dto.customerId) {
      const customer = await this.prisma.customer.findFirst({
        where: {
          id: dto.customerId,
          tenantId: user.tenantId,
          companyId: dto.companyId,
          branchId: dto.branchId ?? null,
        },
      });

      if (!customer) {
        throw new NotFoundException(
          'Customer not found in the selected company and branch',
        );
      }
    }
  }

  private async checkAssignee(
    user: ActivitiesAuthUser,
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
      throw new NotFoundException('Assigned user not found');
    }

    const roles = await this.prisma.userRole.findMany({
      where: { userId: assignedToId },
      include: { role: true },
    });

    const assigneeIsAdmin = roles.some(({ role }) =>
      ['BUSINESS_OWNER', 'BUSINESS_ADMIN'].includes(role.name),
    );

    if (assigneeIsAdmin) {
      return;
    }

    const companyAccess = await this.prisma.userCompanyAccess.findFirst({
      where: {
        userId: assignedToId,
        companyId,
      },
    });

    if (!companyAccess) {
      throw new BadRequestException(
        'Assigned user does not have company access',
      );
    }

    if (branchId) {
      const branchAccess = await this.prisma.userBranchAccess.findFirst({
        where: {
          userId: assignedToId,
          branchId,
        },
      });

      if (!branchAccess) {
        throw new BadRequestException(
          'Assigned user does not have branch access',
        );
      }
    }
  }

  async create(
    user: ActivitiesAuthUser,
    dto: CreateActivityDto,
  ) {
    await this.checkCompanyAccess(user, dto.companyId);

    if (dto.branchId) {
      await this.checkBranchAccess(
        user,
        dto.companyId,
        dto.branchId,
      );
    } else if (!this.isBusinessAdmin(user)) {
      throw new ForbiddenException(
        'Only business administrators can create company-wide activities',
      );
    }

    await this.checkRelatedRecord(user, dto);

    if (dto.assignedToId) {
      await this.checkAssignee(
        user,
        dto.companyId,
        dto.branchId ?? null,
        dto.assignedToId,
      );
    }

    return this.prisma.crmActivity.create({
      data: {
        tenantId: user.tenantId,
        companyId: dto.companyId,
        branchId: dto.branchId ?? null,
        leadId: dto.leadId ?? null,
        customerId: dto.customerId ?? null,
        title: dto.title,
        description: dto.description,
        type: dto.type,
        scheduledAt: new Date(dto.scheduledAt),
        createdById: user.id,
        assignedToId: dto.assignedToId ?? null,
      },
    });
  }

  async findAll(
    user: ActivitiesAuthUser,
    query: ListActivitiesDto,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    if (query.companyId) {
      await this.checkCompanyAccess(user, query.companyId);
    }

    if (query.branchId) {
      if (!query.companyId) {
        throw new BadRequestException(
          'companyId is required when filtering by branchId',
        );
      }

      await this.checkBranchAccess(
        user,
        query.companyId,
        query.branchId,
      );
    }

    if (
      query.fromDate &&
      query.toDate &&
      new Date(query.fromDate) > new Date(query.toDate)
    ) {
      throw new BadRequestException(
        'fromDate cannot be after toDate',
      );
    }

    const where: Prisma.CrmActivityWhereInput = {
      tenantId: user.tenantId,
      ...(query.companyId && { companyId: query.companyId }),
      ...(query.branchId && { branchId: query.branchId }),
      ...(query.leadId && { leadId: query.leadId }),
      ...(query.customerId && { customerId: query.customerId }),
      ...(query.type && { type: query.type }),
      ...(query.status && { status: query.status }),
      ...(query.assignedToId && {
        assignedToId: query.assignedToId,
      }),
      ...(query.search && {
        title: {
          contains: query.search,
          mode: Prisma.QueryMode.insensitive,
        },
      }),
      ...(query.fromDate || query.toDate
        ? {
            scheduledAt: {
              ...(query.fromDate && {
                gte: new Date(query.fromDate),
              }),
              ...(query.toDate && {
                lte: new Date(query.toDate),
              }),
            },
          }
        : {}),
    };

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

      where.AND = [
        { companyId: { in: companyAccess.map((item) => item.companyId) } },
        { branchId: { in: branchAccess.map((item) => item.branchId) } },
      ];
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.crmActivity.findMany({
        where,
        orderBy: [
          { scheduledAt: 'asc' },
          { createdAt: 'desc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.crmActivity.count({ where }),
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

  async findOne(
    user: ActivitiesAuthUser,
    id: string,
  ) {
    return this.checkActivityAccess(user, id);
  }

  async update(
    user: ActivitiesAuthUser,
    id: string,
    dto: UpdateActivityDto,
  ) {
    const activity = await this.checkActivityAccess(user, id);

    if (activity.status !== ActivityStatus.PENDING) {
      throw new ConflictException(
        'Only pending activities can be updated',
      );
    }

    if (dto.assignedToId) {
      await this.checkAssignee(
        user,
        activity.companyId,
        activity.branchId,
        dto.assignedToId,
      );
    }

    return this.prisma.crmActivity.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && {
          title: dto.title,
        }),
        ...(dto.description !== undefined && {
          description: dto.description,
        }),
        ...(dto.type !== undefined && {
          type: dto.type,
        }),
        ...(dto.scheduledAt !== undefined && {
          scheduledAt: new Date(dto.scheduledAt),
        }),
        ...(dto.assignedToId !== undefined && {
          assignedToId: dto.assignedToId,
        }),
      },
    });
  }

  async complete(
    user: ActivitiesAuthUser,
    id: string,
  ) {
    await this.checkActivityAccess(user, id);

    const result = await this.prisma.crmActivity.updateMany({
      where: {
        id,
        tenantId: user.tenantId,
        status: ActivityStatus.PENDING,
      },
      data: {
        status: ActivityStatus.COMPLETED,
        completedAt: new Date(),
      },
    });

    if (result.count === 0) {
      throw new ConflictException(
        'Only pending activities can be completed',
      );
    }

    return this.prisma.crmActivity.findUniqueOrThrow({
      where: { id },
    });
  }

  async cancel(
    user: ActivitiesAuthUser,
    id: string,
  ) {
    await this.checkActivityAccess(user, id);

    const result = await this.prisma.crmActivity.updateMany({
      where: {
        id,
        tenantId: user.tenantId,
        status: ActivityStatus.PENDING,
      },
      data: {
        status: ActivityStatus.CANCELLED,
        completedAt: null,
      },
    });

    if (result.count === 0) {
      throw new ConflictException(
        'Only pending activities can be cancelled',
      );
    }

    return this.prisma.crmActivity.findUniqueOrThrow({
      where: { id },
    });
  }
}
