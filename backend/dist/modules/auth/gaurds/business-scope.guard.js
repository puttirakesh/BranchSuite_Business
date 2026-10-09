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
exports.BusinessScopeGuard = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../prisma/prisma.service");
let BusinessScopeGuard = class BusinessScopeGuard {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const authUser = request.authUser;
        if (!authUser?.id || !authUser.tenantId) {
            throw new common_1.UnauthorizedException('Authentication required');
        }
        const tenantId = request.headers['x-tenant-id'];
        const companyId = request.headers['x-company-id'];
        const branchId = request.headers['x-branch-id'];
        if (typeof tenantId !== 'string' ||
            typeof companyId !== 'string' ||
            typeof branchId !== 'string') {
            throw new common_1.ForbiddenException('Tenant, company and branch headers are required');
        }
        if (tenantId !== authUser.tenantId) {
            throw new common_1.ForbiddenException('Invalid tenant scope');
        }
        const company = await this.prisma.company.findFirst({
            where: {
                id: companyId,
                tenantId: authUser.tenantId,
                status: 'ACTIVE',
                userAccess: {
                    some: { userId: authUser.id },
                },
            },
            select: { id: true },
        });
        if (!company) {
            throw new common_1.ForbiddenException('Company access denied');
        }
        const branch = await this.prisma.branch.findFirst({
            where: {
                id: branchId,
                companyId,
                status: 'ACTIVE',
                userAccess: {
                    some: { userId: authUser.id },
                },
            },
            select: { id: true },
        });
        if (!branch) {
            throw new common_1.ForbiddenException('Branch access denied');
        }
        request.businessScope = {
            tenantId: authUser.tenantId,
            companyId,
            branchId,
        };
        return true;
    }
};
exports.BusinessScopeGuard = BusinessScopeGuard;
exports.BusinessScopeGuard = BusinessScopeGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], BusinessScopeGuard);
//# sourceMappingURL=business-scope.guard.js.map