import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const userDetails = {
  id: true,
  tenantId: true,
  name: true,
  email: true,
  phone: true,
  status: true,
  roles: {
    select: {
      role: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
  companyAccess: {
    select: {
      company: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
  branchAccess: {
    select: {
      branch: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  private async ensureUser(
    tenantId: string,
    id: string,
  ) {
    const user = await this.prisma.user.findFirst({
      where: {
        id,
        tenantId,
      },
      select: {
        id: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async create(
    tenantId: string,
    dto: CreateUserDto,
  ) {
    // Never trust tenantId or status from a client.
    const email = dto.email.trim().toLowerCase();

    if (!dto.name.trim()) {
      throw new BadRequestException(
        'Name cannot be empty',
      );
    }

    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException(
        'Email is already registered',
      );
    }

    const passwordHash = await bcrypt.hash(
      dto.password,
      12,
    );

    try {
      return await this.prisma.user.create({
        data: {
          tenantId,
          name: dto.name.trim(),
          email,
          password: passwordHash,
          phone: dto.phone?.trim(),
          status: UserStatus.ACTIVE,
        },
        select: userDetails,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Email is already registered',
        );
      }

      throw error;
    }
  }

  async findAll(tenantId: string) {
    return this.prisma.user.findMany({
      where: { tenantId },
      select: userDetails,
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(
    tenantId: string,
    id: string,
  ) {
    const user = await this.prisma.user.findFirst({
      where: {
        id,
        tenantId,
      },
      select: userDetails,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateUserDto,
  ) {
    await this.ensureUser(tenantId, id);

    if (
      dto.name !== undefined &&
      !dto.name.trim()
    ) {
      throw new BadRequestException(
        'Name cannot be empty',
      );
    }

    const email = dto.email?.trim().toLowerCase();

    if (email !== undefined) {
      const existing = await this.prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });

      if (existing && existing.id !== id) {
        throw new ConflictException(
          'Email is already registered',
        );
      }
    }

    // Atomic tenant condition prevents cross-tenant updates.
    const data: Prisma.UserUpdateManyMutationInput = {
      ...(dto.name !== undefined && {
        name: dto.name.trim(),
      }),
      ...(email !== undefined && {
        email,
      }),
      ...(dto.phone !== undefined && {
        phone: dto.phone.trim(),
      }),
    };

    try {
      const result = await this.prisma.user.updateMany({
        where: {
          id,
          tenantId,
        },
        data,
      });

      if (result.count === 0) {
        throw new NotFoundException('User not found');
      }
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Email is already registered',
        );
      }

      throw error;
    }

    return this.findOne(tenantId, id);
  }

  async changeStatus(
    tenantId: string,
    id: string,
    status: UserStatus,
    actingUserId: string,
  ) {
    await this.ensureUser(tenantId, id);

    if (
      id === actingUserId &&
      status !== UserStatus.ACTIVE
    ) {
      throw new BadRequestException(
        'You cannot deactivate or suspend your own account',
      );
    }

    const result = await this.prisma.user.updateMany({
      where: {
        id,
        tenantId,
      },
      data: { status },
    });

    if (result.count === 0) {
      throw new NotFoundException('User not found');
    }

    return this.findOne(tenantId, id);
  }

  
  async assignEmployeeRole(
    tenantId: string,
    userId: string,
    actingUserId: string,
  ) {
    if (userId === actingUserId) {
      throw new BadRequestException(
        'You cannot change your own role',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findFirst({
        where: {
          id: userId,
          tenantId,
          status: 'ACTIVE',
        },
        include: {
          roles: {
            include: { role: true },
          },
        },
      });

      if (!user) {
        throw new NotFoundException('Active user not found');
      }

      const hasPrivilegedRole = user.roles.some(({ role }) =>
        ['BUSINESS_OWNER', 'BUSINESS_ADMIN'].includes(role.name),
      );

      if (hasPrivilegedRole) {
        throw new ForbiddenException(
          'Administrator roles cannot be changed here',
        );
      }

      const role = await tx.role.upsert({
        where: { name: 'EMPLOYEE' },
        update: {},
        create: {
          name: 'EMPLOYEE',
          description: 'Standard employee',
        },
      });

      await tx.userRole.upsert({
        where: {
          userId_roleId: {
            userId,
            roleId: role.id,
          },
        },
        update: {},
        create: {
          userId,
          roleId: role.id,
        },
      });

      return {
        message: 'Employee role assigned successfully',
        userId,
        role: role.name,
      };
    });
  }

  async assignAccess(
    tenantId: string,
    userId: string,
    companyId: string,
    branchIds: string[],
  ) {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findFirst({
        where: {
          id: userId,
          tenantId,
          status: 'ACTIVE',
        },
        select: { id: true },
      });

      if (!user) {
        throw new NotFoundException('Active user not found');
      }

      const company = await tx.company.findFirst({
        where: {
          id: companyId,
          tenantId,
          status: 'ACTIVE',
        },
        select: { id: true, name: true },
      });

      if (!company) {
        throw new NotFoundException(
          'Active company not found',
        );
      }

      const uniqueBranchIds = [...new Set(branchIds)];

      if (uniqueBranchIds.length === 0) {
        throw new BadRequestException(
          'At least one branch is required',
        );
      }

      const branches = await tx.branch.findMany({
        where: {
          id: { in: uniqueBranchIds },
          companyId,
          status: 'ACTIVE',
        },
        select: {
          id: true,
          name: true,
        },
      });

      if (branches.length !== uniqueBranchIds.length) {
        throw new BadRequestException(
          'All branches must belong to the selected company and be active',
        );
      }

      await tx.userCompanyAccess.upsert({
        where: {
          userId_companyId: {
            userId,
            companyId,
          },
        },
        update: {},
        create: {
          userId,
          companyId,
        },
      });

      for (const branch of branches) {
        await tx.userBranchAccess.upsert({
          where: {
            userId_branchId: {
              userId,
              branchId: branch.id,
            },
          },
          update: {},
          create: {
            userId,
            branchId: branch.id,
          },
        });
      }

      return {
        message: 'Company and branch access assigned successfully',
        userId,
        company,
        branches,
      };
    });
  }

}
