import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { Prisma, UserStatus } from "@prisma/client";
import * as bcrypt from "bcrypt";

import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { assignableRoles, AssignableRole } from "./dto/assign-role.dto";

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
    private readonly audit: AuditService,
  ) {}

  // =====================================================
  // VERIFY USER BELONGS TO TENANT
  // =====================================================

  private async ensureUser(tenantId: string, id: string) {
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
      throw new NotFoundException("User not found");
    }

    return user;
  }

  // =====================================================
  // CREATE STAFF WITH AUTOMATIC EMPLOYEE ROLE
  // =====================================================

  async create(
    actor: { id: string; tenantId: string; roles: string[] },
    dto: CreateUserDto,
  ) {
    const tenantId = actor.tenantId;
    const name = dto.name.trim();
    const email = dto.email.trim().toLowerCase();

    if (!name) {
      throw new BadRequestException("Name cannot be empty");
    }

    if (!email) {
      throw new BadRequestException("Email cannot be empty");
    }

    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException("Email is already registered");
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const employeeRole = await tx.role.upsert({
          where: {
            name: "EMPLOYEE",
          },
          update: {},
          create: {
            name: "EMPLOYEE",
            description: "Standard employee",
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

        await this.audit.record(tx, {
          actor,
          module: "ACCESS",
          action: "STAFF_CREATED",
          targetId: user.id,
          detail: `Staff account created for ${name}`,
        });
        return tx.user.findFirstOrThrow({
          where: {
            id: user.id,
            tenantId,
          },
          select: userDetails,
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException("Email is already registered");
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
        createdAt: "desc",
      },
    });
  }

  // =====================================================
  // GET USER BY ID
  // =====================================================

  async findOne(tenantId: string, id: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id,
        tenantId,
      },
      select: userDetails,
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return user;
  }

  // =====================================================
  // UPDATE USER PROFILE
  // =====================================================

  async update(actor: { id: string; tenantId: string; roles: string[] }, id: string, dto: UpdateUserDto) {
    if (!actor.roles.some(role => ['BUSINESS_OWNER', 'BUSINESS_ADMIN'].includes(role))) {
      throw new ForbiddenException('Business administrator required');
    }
    const tenantId = actor.tenantId;

    if (dto.name !== undefined && !dto.name.trim()) {
      throw new BadRequestException("Name cannot be empty");
    }

    const email = dto.email?.trim().toLowerCase();

    if (email !== undefined) {
      if (!email) {
        throw new BadRequestException("Email cannot be empty");
      }

      const existing = await this.prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });

      if (existing && existing.id !== id) {
        throw new ConflictException("Email is already registered");
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
      return await this.prisma.$transaction(async tx => {
        const target = await tx.user.findFirst({
          where: { id, tenantId },
          select: { id: true, email: true, tokenVersion: true, roles: { select: { role: { select: { name: true } } } } },
        });
        if (!target) throw new NotFoundException('User not found');
        if (actor.id !== id && target.roles.some(({ role }) =>
          role.name === 'BUSINESS_OWNER' || (role.name === 'BUSINESS_ADMIN' && !actor.roles.includes('BUSINESS_OWNER')))) {
          throw new ForbiddenException('This administrator profile cannot be changed through staff management');
        }
        const result = await tx.user.updateMany({
          where: {
            id,
            tenantId,
            tokenVersion: target.tokenVersion,
          },
          data: { ...data, ...(email !== undefined && email !== target.email ? { tokenVersion: { increment: 1 } } : {}) },
        });

        if (result.count === 0) {
          throw new ConflictException('Account access changed. Reload and retry.');
        }
        await this.audit.record(tx, { actor, module: 'ACCESS', action: 'STAFF_PROFILE_UPDATED', targetId: id,
          changes: { fields: Object.keys(data), sessionRevoked: email !== undefined && email !== target.email } });
        return tx.user.findFirstOrThrow({ where: { id, tenantId }, select: userDetails });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException("Email is already registered");
      }

      throw error;
    }

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
    if (id === actingUserId && status !== UserStatus.ACTIVE) {
      throw new BadRequestException(
        "You cannot deactivate or suspend your own account",
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
        throw new NotFoundException("User not found");
      }

      const isPrivilegedUser = user.roles.some(({ role }) =>
        ["BUSINESS_OWNER", "BUSINESS_ADMIN"].includes(role.name),
      );

      if (isPrivilegedUser) {
        throw new ForbiddenException(
          "Business Owner and Business Admin status cannot be changed through staff management",
        );
      }

      if (user.status === status) {
        return;
      }
      if (status !== UserStatus.ACTIVE && await tx.branch.count({ where: { managerUserId: id } })) {
        throw new ConflictException('Reassign this user’s managed branches before deactivating the account');
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
          "Account status changed during this request. Please retry.",
        );
      }
      await this.audit.record(tx, {
        actor: { id: actingUserId, tenantId, roles: ["BUSINESS_ADMIN"] },
        module: "ACCESS",
        action: "STAFF_STATUS_CHANGED",
        targetId: id,
        detail: `Staff account status changed to ${status}`,
        changes: { previousStatus: user.status, newStatus: status },
      });
    });

    return this.findOne(tenantId, id);
  }

  // =====================================================
  // REPLACE STAFF ROLE
  // =====================================================

  async replaceRole(
    actor: { id: string; tenantId: string; roles: string[] },
    userId: string,
    roleName: AssignableRole,
  ) {
    if (!actor.roles.some(role => ['BUSINESS_OWNER', 'BUSINESS_ADMIN'].includes(role))) {
      throw new ForbiddenException('Business administrator required');
    }
    if (!assignableRoles.includes(roleName)) throw new BadRequestException('Invalid role');
    const owner = actor.roles.includes('BUSINESS_OWNER');
    if (roleName === 'BUSINESS_ADMIN' && !owner) {
      throw new ForbiddenException('Only a business owner can assign administrators');
    }
    if (userId === actor.id) {
      throw new BadRequestException("You cannot change your own role");
    }

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findFirst({
        where: {
          id: userId,
          tenantId: actor.tenantId,
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
        throw new NotFoundException("User not found");
      }

      const hasPrivilegedRole = user.roles.some(({ role }) =>
        role.name === 'BUSINESS_OWNER' || (role.name === 'BUSINESS_ADMIN' && !owner),
      );

      if (hasPrivilegedRole) {
        throw new ForbiddenException(
          "Administrator roles cannot be changed here",
        );
      }

      if (roleName !== 'BRANCH_MANAGER' && tx.branch && await tx.branch.count({ where: { managerUserId: userId } })) {
        throw new ConflictException('Reassign this user’s managed branches before changing the branch manager role');
      }

      const role = await tx.role.findUnique({
        where: {
          name: roleName,
        },
      });
      if (!role) throw new BadRequestException('Role is not configured');
      if (user.roles.length === 1 && user.roles[0].role.name === roleName) {
        return { message: 'Role already assigned', userId, role: roleName };
      }

      await tx.userRole.deleteMany({ where: { userId } });
      await tx.userRole.create({ data: { userId, roleId: role.id } });
      await tx.user.update({
        where: { id: userId },
        data: { tokenVersion: { increment: 1 } },
      });
      await this.audit.record(tx, {
        actor, module: 'ACCESS', action: 'STAFF_ROLE_CHANGED', targetId: userId,
        detail: `Staff role changed to ${roleName}`,
        changes: { previousRoles: user.roles.map(item => item.role.name), role: roleName },
      });

      return {
        message: "Role updated successfully. The user must sign in again.",
        userId,
        role: role.name,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  // =====================================================
  // ASSIGN COMPANY AND BRANCH ACCESS
  // =====================================================

  async assignAccess(
    actor: { id: string; tenantId: string; roles: string[] },
    userId: string,
    companyId: string,
    branchIds: string[],
  ) {
    const tenantId = actor.tenantId;
    if (!actor.roles.some(role => ['BUSINESS_OWNER', 'BUSINESS_ADMIN'].includes(role))) throw new ForbiddenException('Business administrator required');
    if (actor.id === userId) throw new BadRequestException('You cannot change your own access');
    const owner = actor.roles.includes('BUSINESS_OWNER');
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findFirst({
        where: {
          id: userId,
          tenantId,
          status: UserStatus.ACTIVE,
        },
        select: {
          id: true,
          roles: { select: { role: { select: { name: true } } } },
        },
      });

      if (!user) {
        throw new NotFoundException("Active user not found");
      }
      if (user.roles.some(({ role }) => ['BUSINESS_OWNER', 'BUSINESS_ADMIN'].includes(role.name))) {
        throw new ForbiddenException('Privileged administrator access cannot be changed here');
      }

      const company = await tx.company.findFirst({
        where: {
          id: companyId,
          tenantId,
          status: "ACTIVE",
          ...(!owner ? { userAccess: { some: { userId: actor.id } } } : {}),
        },
        select: {
          id: true,
          name: true,
        },
      });

      if (!company) {
        throw new NotFoundException("Active company not found");
      }

      const uniqueBranchIds = [...new Set(branchIds)];

      if (uniqueBranchIds.length === 0) {
        throw new BadRequestException("At least one branch is required");
      }

      const branches = await tx.branch.findMany({
        where: {
          id: {
            in: uniqueBranchIds,
          },
          companyId,
          status: "ACTIVE",
          ...(!owner ? { userAccess: { some: { userId: actor.id } } } : {}),
        },
        select: {
          id: true,
          name: true,
        },
      });

      if (branches.length !== uniqueBranchIds.length) {
        throw new BadRequestException(
          "All branches must belong to the selected company and be active",
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
      await tx.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } });
      await this.audit.record(tx, { actor, companyId, module: 'ACCESS', action: 'BRANCH_ACCESS_GRANTED', targetId: userId, changes: { branchIds: uniqueBranchIds } });

      return {
        message: "Company and branch access assigned successfully",
        userId,
        company,
        branches,
      };
    });
  }

  // Atomically replace access for ONE company. Other companies are untouched.
  // Only owners can manage access across all their tenant's companies;
  // other administrators must already have company and branch access.
  async replaceCompanyAccess(
    actor: { id: string; tenantId: string; roles: string[] },
    userId: string,
    companyId: string,
    branchIds: string[],
  ) {
    if (!actor.roles.some(role => ['BUSINESS_OWNER', 'BUSINESS_ADMIN'].includes(role))) throw new ForbiddenException('Business administrator required');
    if (actor.id === userId) {
      throw new BadRequestException("You cannot change your own access");
    }
    const owner = actor.roles.includes("BUSINESS_OWNER");
    const requested = [...new Set(branchIds)];
    return this.prisma.$transaction(
      async (tx) => {
        const target = await tx.user.findFirst({
          where: { id: userId, tenantId: actor.tenantId },
          select: {
            id: true,
            roles: { select: { role: { select: { name: true } } } },
          },
        });
        if (!target) throw new NotFoundException("User not found");
        if (
          target.roles.some((item) =>
            ["BUSINESS_OWNER", "BUSINESS_ADMIN"].includes(item.role.name),
          )
        ) {
          throw new ForbiddenException(
            "Privileged administrator access cannot be changed here",
          );
        }
        const company = await tx.company.findFirst({
          where: {
            id: companyId,
            tenantId: actor.tenantId,
            status: "ACTIVE",
            ...(!owner ? { userAccess: { some: { userId: actor.id } } } : {}),
          },
          select: { id: true },
        });
        if (!company)
          throw new NotFoundException("Company not found or access denied");
        const managedBranchIds = (await tx.branch.findMany({ where: { companyId, managerUserId: userId }, select: { id: true } })).map(branch => branch.id);
        if (managedBranchIds.some(id => !requested.includes(id))) {
          throw new ConflictException('Reassign managed branches before removing their manager’s access');
        }
        const available = await tx.branch.findMany({
          where: {
            companyId,
            status: "ACTIVE",
            id: { in: requested },
            ...(!owner ? { userAccess: { some: { userId: actor.id } } } : {}),
          },
          select: { id: true },
        });
        if (available.length !== requested.length) {
          throw new BadRequestException(
            "Selected branches are inactive, invalid or outside your access",
          );
        }
        // Non-owners cannot silently remove branches beyond their own scope.
        if (!owner) {
          const inaccessibleExisting = await tx.userBranchAccess.count({
            where: {
              userId,
              branch: { companyId, userAccess: { none: { userId: actor.id } } },
            },
          });
          if (inaccessibleExisting) {
            throw new ForbiddenException(
              "Target has other branch access; an owner must update this account",
            );
          }
        }
        await tx.userBranchAccess.deleteMany({ where: { userId, branch: { companyId, id: { notIn: requested } } } });
        if (requested.length) {
          await tx.userCompanyAccess.upsert({
            where: { userId_companyId: { userId, companyId } },
            create: { userId, companyId },
            update: {},
          });
          await tx.userBranchAccess.createMany({
            data: requested.map((branchId) => ({ userId, branchId, grantSource: managedBranchIds.includes(branchId) ? 'BRANCH_MANAGER' : 'MANUAL' })),
            skipDuplicates: true,
          });
        } else {
          await tx.userCompanyAccess.deleteMany({
            where: { userId, companyId },
          });
        }
        await tx.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } });
        await this.audit.record(tx, {
          actor,
          companyId,
          module: "ACCESS",
          action: "BRANCH_ACCESS_REPLACED",
          targetId: userId,
          detail: "Staff company branch access updated",
          changes: { branchIds: requested },
        });
        return tx.user.findFirstOrThrow({
          where: { id: userId, tenantId: actor.tenantId },
          select: userDetails,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
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
    actor: { id: string; tenantId: string; roles: string[] },
    userId: string,
    companyId: string,
    branchIds: string[],
  ) {
    const tenantId = actor.tenantId;
    if (!actor.roles.some(role => ['BUSINESS_OWNER', 'BUSINESS_ADMIN'].includes(role))) throw new ForbiddenException('Business administrator required');
    const owner = actor.roles.includes('BUSINESS_OWNER');
    if (userId === actor.id) {
      throw new BadRequestException("You cannot revoke your own access");
    }

    return this.prisma.$transaction(async (tx) => {
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
        throw new NotFoundException("User not found");
      }

      const hasPrivilegedRole = user.roles.some(({ role }) =>
        ["BUSINESS_OWNER", "BUSINESS_ADMIN"].includes(role.name),
      );

      if (hasPrivilegedRole) {
        throw new ForbiddenException(
          "Administrator access cannot be revoked here",
        );
      }

      const assignedBranchCount = await tx.branch.count({ where: { id: { in: branchIds }, companyId, managerUserId: userId } });
      if (assignedBranchCount) throw new ConflictException('Reassign this user’s managed branches before revoking access');

      // ---------------------------------------------
      // STEP 2: VERIFY COMPANY BELONGS TO TENANT
      // ---------------------------------------------

      const company = await tx.company.findFirst({
        where: {
          id: companyId,
          tenantId,
          ...(!owner ? { userAccess: { some: { userId: actor.id } } } : {}),
        },
        select: {
          id: true,
          name: true,
        },
      });

      if (!company) {
        throw new NotFoundException("Company not found");
      }

      // ---------------------------------------------
      // STEP 3: VALIDATE BRANCHES
      // ---------------------------------------------

      const uniqueBranchIds = [...new Set(branchIds)];

      if (uniqueBranchIds.length === 0) {
        throw new BadRequestException("At least one branch is required");
      }

      const branches = await tx.branch.findMany({
        where: {
          id: {
            in: uniqueBranchIds,
          },
          companyId,
          ...(!owner ? { userAccess: { some: { userId: actor.id } } } : {}),
        },
        select: {
          id: true,
          name: true,
        },
      });

      if (branches.length !== uniqueBranchIds.length) {
        throw new BadRequestException(
          "All branches must belong to the selected company",
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

      const remainingBranchCount = await tx.userBranchAccess.count({
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
        const companyAccess = await tx.userCompanyAccess.deleteMany({
          where: {
            userId,
            companyId,
          },
        });

        companyAccessRemoved = companyAccess.count > 0;
      }
      if (removed.count || companyAccessRemoved) {
        await tx.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } });
        await this.audit.record(tx, { actor, companyId, module: 'ACCESS', action: 'BRANCH_ACCESS_REVOKED', targetId: userId,
          changes: { branchIds: uniqueBranchIds, companyAccessRemoved } });
      }

      // ---------------------------------------------
      // STEP 7: RETURN UPDATED ACCESS DETAILS
      // ---------------------------------------------

      const updatedUser = await tx.user.findFirstOrThrow({
        where: {
          id: userId,
          tenantId,
        },
        select: userDetails,
      });

      return {
        message: "Selected branch access revoked successfully",
        userId,
        company,
        requestedBranches: branches,
        removedBranchAccessCount: removed.count,
        remainingBranchCount,
        companyAccessRemoved,
        user: updatedUser,
      };
    });
  }
}
