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
exports.BranchesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
let BranchesService = class BranchesService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(tenantId, actingUserId, dto) {
        const name = dto.name.trim();
        if (!name) {
            throw new common_1.BadRequestException('Branch name is required');
        }
        const company = await this.prisma.company.findFirst({
            where: {
                id: dto.companyId,
                tenantId,
                status: 'ACTIVE',
                userAccess: {
                    some: {
                        userId: actingUserId,
                    },
                },
            },
        });
        if (!company) {
            throw new common_1.NotFoundException('Active company not found or access denied');
        }
        const existing = await this.prisma.branch.findFirst({
            where: {
                companyId: company.id,
                name: {
                    equals: name,
                    mode: 'insensitive',
                },
            },
        });
        if (existing) {
            throw new common_1.ConflictException('Branch already exists in this company');
        }
        return this.prisma.$transaction(async (tx) => {
            const branch = await tx.branch.create({
                data: {
                    companyId: company.id,
                    name,
                    status: 'ACTIVE',
                },
            });
            await tx.userBranchAccess.create({
                data: {
                    userId: actingUserId,
                    branchId: branch.id,
                },
            });
            return branch;
        });
    }
    async findAll(tenantId, actingUserId, companyId) {
        return this.prisma.branch.findMany({
            where: {
                ...(companyId && { companyId }),
                company: {
                    tenantId,
                    userAccess: {
                        some: {
                            userId: actingUserId,
                        },
                    },
                },
                userAccess: {
                    some: {
                        userId: actingUserId,
                    },
                },
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
};
exports.BranchesService = BranchesService;
exports.BranchesService = BranchesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], BranchesService);
//# sourceMappingURL=branches.service.js.map