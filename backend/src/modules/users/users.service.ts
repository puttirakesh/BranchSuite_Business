
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

  // =====================================================
  // VERIFY USER BELONGS TO TENANT
  // =====================================================

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

  // =====================================================
  // CREATE STAFF WITH AUTOMATIC EMPLOYEE ROLE
  // =====================================================

  async create(
    tenantId: string,
    dto: CreateUserDto,
  ) {
    const name = dto.name.trim();
    const email = dto.email.trim().toLowerCase();

    if (!name) {
      throw new BadRequestException(
        'Name cannot be empty',
      );
    }

    if (!email) {
      throw new BadRequestException(
        'Email cannot be empty',
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
      return await this.prisma.$transaction(
        async (tx) => {
          const employeeRole = await tx.role.upsert({
            where: {
              name: 'EMPLOYEE',
            },
            update: {},
            create: {
              name: 'EMPLOYEE',
              description: 'Standard employee',
            },
          });

          const user = await tx.user.create({
            data: {
              tenantId,
              name,
              email,
              password: passwordHash,
              phone: dto.phone?.trim(),
              status: UserStatus.ACTIVE,
            },
            select: {
              id: true,
            },
          });

          await tx.userRole.create({
            data: {
              userId: user.id,
              roleId: employeeRole.id,
            },
          });

          return tx.user.findFirstOrThrow({
            where: {
              id: user.id,
              tenantId,
            },
            select: userDetails,
          });
        },
      );
    } catch (error) {
      if (
        error instanceof
          Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Email is already registered',
        );
      }

      throw error;
    }
  }

  // =====================================================
  // GET ALL USERS
  // =====================================================

  async findAll(tenantId: string) {
    return this.prisma.user.findMany({
      where: {
        tenantId,
      },
      select: userDetails,
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  // =====================================================
  // GET USER BY ID
  // =====================================================

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

  // =====================================================
  // UPDATE USER PROFILE
  // =====================================================

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
      if (!email) {
        throw new BadRequestException(
          'Email cannot be empty',
        );
      }

      const existing =
        await this.prisma.user.findUnique({
          where: { email },
          select: { id: true },
        });

      if (existing && existing.id !== id) {
        throw new ConflictException(
          'Email is already registered',
        );
      }
    }

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
        throw new NotFoundException(
          'User not found',
        );
      }
    } catch (error) {
      if (
        error instanceof
          Prisma.PrismaClientKnownRequestError &&
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

  // =====================================================
  // CHANGE USER STATUS
  // =====================================================


  // =====================================================
  // CHANGE USER STATUS SECURELY
  // =====================================================

  async changeStatus(
    tenantId: string,
    id: string,
    status: UserStatus,
    actingUserId: string,
  ) {
    if (
      id === actingUserId &&
      status !== UserStatus.ACTIVE
    ) {
      throw new BadRequestException(
        'You cannot deactivate or suspend your own account',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findFirst({
        where: {
          id,
          tenantId,
        },
        select: {
          id: true,
          status: true,
          roles: {
            select: {
              role: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      });

      if (!user) {
        throw new NotFoundException(
          'User not found',
        );
      }

      const isPrivilegedUser = user.roles.some(
        ({ role }) =>
          [
            'BUSINESS_OWNER',
            'BUSINESS_ADMIN',
          ].includes(role.name),
      );

      if (isPrivilegedUser) {
        throw new ForbiddenException(
          'Business Owner and Business Admin status cannot be changed through staff management',
        );
      }

      if (user.status === status) {
        return;
      }

      const result = await tx.user.updateMany({
        where: {
          id,
          tenantId,
          status: user.status,
        },
        data: {
          status,
          tokenVersion: {
            increment: 1,
          },
        },
      });

      if (result.count !== 1) {
        throw new ConflictException(
          'Account status changed during this request. Please retry.',
        );
      }
    });

    return this.findOne(tenantId, id);
  }


  // =====================================================
  // ASSIGN EMPLOYEE ROLE
  // =====================================================

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

    return this.prisma.$transaction(
      async (tx) => {
        const user = await tx.user.findFirst({
          where: {
            id: userId,
            tenantId,
            status: UserStatus.ACTIVE,
          },
          include: {
            roles: {
              include: {
                role: true,
              },
            },
          },
        });

        if (!user) {
          throw new NotFoundException(
            'Active user not found',
          );
        }

        const hasPrivilegedRole = user.roles.some(
          ({ role }) =>
            [
              'BUSINESS_OWNER',
              'BUSINESS_ADMIN',
            ].includes(role.name),
        );

        if (hasPrivilegedRole) {
          throw new ForbiddenException(
            'Administrator roles cannot be changed here',
          );
        }

        const role = await tx.role.upsert({
          where: {
            name: 'EMPLOYEE',
          },
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
          message:
            'Employee role assigned successfully',
          userId,
          role: role.name,
        };
      },
    );
  }

  // =====================================================
  // ASSIGN COMPANY AND BRANCH ACCESS
  // =====================================================

  async assignAccess(
    tenantId: string,
    userId: string,
    companyId: string,
    branchIds: string[],
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const user = await tx.user.findFirst({
          where: {
            id: userId,
            tenantId,
            status: UserStatus.ACTIVE,
          },
          select: {
            id: true,
          },
        });

        if (!user) {
          throw new NotFoundException(
            'Active user not found',
          );
        }

        const company = await tx.company.findFirst({
          where: {
            id: companyId,
            tenantId,
            status: 'ACTIVE',
          },
          select: {
            id: true,
            name: true,
          },
        });

        if (!company) {
          throw new NotFoundException(
            'Active company not found',
          );
        }

        const uniqueBranchIds = [
          ...new Set(branchIds),
        ];

        if (uniqueBranchIds.length === 0) {
          throw new BadRequestException(
            'At least one branch is required',
          );
        }

        const branches = await tx.branch.findMany({
          where: {
            id: {
              in: uniqueBranchIds,
            },
            companyId,
            status: 'ACTIVE',
          },
          select: {
            id: true,
            name: true,
          },
        });

        if (
          branches.length !==
          uniqueBranchIds.length
        ) {
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
          message:
            'Company and branch access assigned successfully',
          userId,
          company,
          branches,
        };
      },
    );
  }

  // =====================================================
  // REVOKE SELECTED COMPANY / BRANCH ACCESS
  // =====================================================
  //
  // Removes only selected branch access records.
  //
  // If no branches remain for this user in the
  // selected company, company access is also removed.
  //
  // Does NOT delete users, companies, or branches.
  // =====================================================

  async revokeAccess(
    tenantId: string,
    userId: string,
    actingUserId: string,
    companyId: string,
    branchIds: string[],
  ) {
    if (userId === actingUserId) {
      throw new BadRequestException(
        'You cannot revoke your own access',
      );
    }

    return this.prisma.$transaction(
      async (tx) => {
        // ---------------------------------------------
        // STEP 1: VERIFY TARGET USER AND ROLES
        // ---------------------------------------------

        const user = await tx.user.findFirst({
          where: {
            id: userId,
            tenantId,
          },
          select: {
            id: true,
            roles: {
              select: {
                role: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        });

        if (!user) {
          throw new NotFoundException(
            'User not found',
          );
        }

        const hasPrivilegedRole = user.roles.some(
          ({ role }) =>
            [
              'BUSINESS_OWNER',
              'BUSINESS_ADMIN',
            ].includes(role.name),
        );

        if (hasPrivilegedRole) {
          throw new ForbiddenException(
            'Administrator access cannot be revoked here',
          );
        }

        // ---------------------------------------------
        // STEP 2: VERIFY COMPANY BELONGS TO TENANT
        // ---------------------------------------------

        const company = await tx.company.findFirst({
          where: {
            id: companyId,
            tenantId,
          },
          select: {
            id: true,
            name: true,
          },
        });

        if (!company) {
          throw new NotFoundException(
            'Company not found',
          );
        }

        // ---------------------------------------------
        // STEP 3: VALIDATE BRANCHES
        // ---------------------------------------------

        const uniqueBranchIds = [
          ...new Set(branchIds),
        ];

        if (uniqueBranchIds.length === 0) {
          throw new BadRequestException(
            'At least one branch is required',
          );
        }

        const branches = await tx.branch.findMany({
          where: {
            id: {
              in: uniqueBranchIds,
            },
            companyId,
          },
          select: {
            id: true,
            name: true,
          },
        });

        if (
          branches.length !==
          uniqueBranchIds.length
        ) {
          throw new BadRequestException(
            'All branches must belong to the selected company',
          );
        }

        // ---------------------------------------------
        // STEP 4: REMOVE SELECTED BRANCH ACCESS
        // ---------------------------------------------

        const removed = await tx.userBranchAccess.deleteMany({
          where: {
            userId,
            branchId: {
              in: uniqueBranchIds,
            },
          },
        });

        // ---------------------------------------------
        // STEP 5: CHECK REMAINING COMPANY BRANCHES
        // ---------------------------------------------

        const remainingBranchCount =
          await tx.userBranchAccess.count({
            where: {
              userId,
              branch: {
                companyId,
              },
            },
          });

        // ---------------------------------------------
        // STEP 6: REMOVE COMPANY ACCESS IF EMPTY
        // ---------------------------------------------

        let companyAccessRemoved = false;

        if (remainingBranchCount === 0) {
          const companyAccess =
            await tx.userCompanyAccess.deleteMany({
              where: {
                userId,
                companyId,
              },
            });

          companyAccessRemoved =
            companyAccess.count > 0;
        }

        // ---------------------------------------------
        // STEP 7: RETURN UPDATED ACCESS DETAILS
        // ---------------------------------------------

        const updatedUser =
          await tx.user.findFirstOrThrow({
            where: {
              id: userId,
              tenantId,
            },
            select: userDetails,
          });

        return {
          message:
            'Selected branch access revoked successfully',
          userId,
          company,
          requestedBranches: branches,
          removedBranchAccessCount: removed.count,
          remainingBranchCount,
          companyAccessRemoved,
          user: updatedUser,
        };
      },
    );
  }
}
