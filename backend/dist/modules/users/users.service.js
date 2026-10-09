"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const bcrypt = require("bcrypt");
const prisma_service_1 = require("../../prisma/prisma.service");
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
};
let UsersService = class UsersService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async ensureUser(tenantId, id) {
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
            throw new common_1.NotFoundException('User not found');
        }
        return user;
    }
    async create(tenantId, dto) {
        const email = dto.email.trim().toLowerCase();
        if (!dto.name.trim()) {
            throw new common_1.BadRequestException('Name cannot be empty');
        }
        const existing = await this.prisma.user.findUnique({
            where: { email },
            select: { id: true },
        });
        if (existing) {
            throw new common_1.ConflictException('Email is already registered');
        }
        const passwordHash = await bcrypt.hash(dto.password, 12);
        try {
            return await this.prisma.user.create({
                data: {
                    tenantId,
                    name: dto.name.trim(),
                    email,
                    password: passwordHash,
                    phone: dto.phone?.trim(),
                    status: client_1.UserStatus.ACTIVE,
                },
                select: userDetails,
            });
        }
        catch (error) {
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2002') {
                throw new common_1.ConflictException('Email is already registered');
            }
            throw error;
        }
    }
    async findAll(tenantId) {
        return this.prisma.user.findMany({
            where: { tenantId },
            select: userDetails,
            orderBy: {
                createdAt: 'desc',
            },
        });
    }
    async findOne(tenantId, id) {
        const user = await this.prisma.user.findFirst({
            where: {
                id,
                tenantId,
            },
            select: userDetails,
        });
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        return user;
    }
    async update(tenantId, id, dto) {
        await this.ensureUser(tenantId, id);
        if (dto.name !== undefined &&
            !dto.name.trim()) {
            throw new common_1.BadRequestException('Name cannot be empty');
        }
        const email = dto.email?.trim().toLowerCase();
        if (email !== undefined) {
            const existing = await this.prisma.user.findUnique({
                where: { email },
                select: { id: true },
            });
            if (existing && existing.id !== id) {
                throw new common_1.ConflictException('Email is already registered');
            }
        }
        const data = {
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
                throw new common_1.NotFoundException('User not found');
            }
        }
        catch (error) {
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2002') {
                throw new common_1.ConflictException('Email is already registered');
            }
            throw error;
        }
        return this.findOne(tenantId, id);
    }
    async changeStatus(tenantId, id, status, actingUserId) {
        await this.ensureUser(tenantId, id);
        if (id === actingUserId &&
            status !== client_1.UserStatus.ACTIVE) {
            throw new common_1.BadRequestException('You cannot deactivate or suspend your own account');
        }
        const result = await this.prisma.user.updateMany({
            where: {
                id,
                tenantId,
            },
            data: { status },
        });
        if (result.count === 0) {
            throw new common_1.NotFoundException('User not found');
        }
        return this.findOne(tenantId, id);
    }
    async assignEmployeeRole(tenantId, userId, actingUserId) {
        if (userId === actingUserId) {
            throw new common_1.BadRequestException('You cannot change your own role');
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
                throw new common_1.NotFoundException('Active user not found');
            }
            const hasPrivilegedRole = user.roles.some(({ role }) => ['BUSINESS_OWNER', 'BUSINESS_ADMIN'].includes(role.name));
            if (hasPrivilegedRole) {
                throw new common_1.ForbiddenException('Administrator roles cannot be changed here');
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
    async assignAccess(tenantId, userId, companyId, branchIds) {
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
                throw new common_1.NotFoundException('Active user not found');
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
                throw new common_1.NotFoundException('Active company not found');
            }
            const uniqueBranchIds = [...new Set(branchIds)];
            if (uniqueBranchIds.length === 0) {
                throw new common_1.BadRequestException('At least one branch is required');
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
                throw new common_1.BadRequestException('All branches must belong to the selected company and be active');
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
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], UsersService);
//# sourceMappingURL=users.service.js.map