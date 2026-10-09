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
exports.JwtAuthGuard = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const prisma_service_1 = require("../../../prisma/prisma.service");
let JwtAuthGuard = class JwtAuthGuard {
    jwtService;
    prisma;
    constructor(jwtService, prisma) {
        this.jwtService = jwtService;
        this.prisma = prisma;
    }
    async canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const authorization = request.headers.authorization;
        if (typeof authorization !== "string" ||
            !authorization.startsWith("Bearer ")) {
            throw new common_1.UnauthorizedException("Missing access token");
        }
        const token = authorization.slice(7).trim();
        if (!token) {
            throw new common_1.UnauthorizedException("Missing access token");
        }
        let payload;
        try {
            payload =
                await this.jwtService.verifyAsync(token);
        }
        catch {
            throw new common_1.UnauthorizedException("Invalid or expired access token");
        }
        if (!payload.sub ||
            !payload.tenantId ||
            typeof payload.tokenVersion !== "number" ||
            !Number.isInteger(payload.tokenVersion) ||
            payload.tokenVersion < 0) {
            throw new common_1.UnauthorizedException("Invalid access token");
        }
        const user = await this.prisma.user.findUnique({
            where: {
                id: payload.sub,
            },
            include: {
                tenant: true,
                roles: {
                    include: {
                        role: true,
                    },
                },
            },
        });
        if (!user ||
            user.status !== "ACTIVE" ||
            !user.tenantId ||
            user.tenantId !== payload.tenantId ||
            user.tenant?.status !== "ACTIVE") {
            throw new common_1.UnauthorizedException("Account is not active");
        }
        if (user.tokenVersion !== payload.tokenVersion) {
            throw new common_1.UnauthorizedException("Your session has expired. Please sign in again.");
        }
        request.authUser = {
            id: user.id,
            tenantId: user.tenantId,
            roles: user.roles.map(({ role }) => role.name),
        };
        return true;
    }
};
exports.JwtAuthGuard = JwtAuthGuard;
exports.JwtAuthGuard = JwtAuthGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [jwt_1.JwtService,
        prisma_service_1.PrismaService])
], JwtAuthGuard);
//# sourceMappingURL=jwt-auth.guard.js.map