"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthModule = void 0;
require("dotenv/config");
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const auth_controller_1 = require("./auth.controller");
const auth_service_1 = require("./auth.service");
const jwt_auth_guard_1 = require("./gaurds/jwt-auth.guard");
const business_admin_guard_1 = require("./gaurds/business-admin.guard");
const permissions_guard_1 = require("./gaurds/permissions.guard");
const business_scope_guard_1 = require("./gaurds/business-scope.guard");
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must contain at least 32 characters');
}
let AuthModule = class AuthModule {
};
exports.AuthModule = AuthModule;
exports.AuthModule = AuthModule = __decorate([
    (0, common_1.Module)({
        imports: [
            jwt_1.JwtModule.register({
                secret: jwtSecret,
                signOptions: {
                    expiresIn: '1d',
                },
            }),
        ],
        controllers: [auth_controller_1.AuthController],
        providers: [
            auth_service_1.AuthService,
            jwt_auth_guard_1.JwtAuthGuard,
            business_admin_guard_1.BusinessAdminGuard,
            permissions_guard_1.PermissionsGuard,
            business_scope_guard_1.BusinessScopeGuard,
        ],
        exports: [
            jwt_1.JwtModule,
            jwt_auth_guard_1.JwtAuthGuard,
            business_admin_guard_1.BusinessAdminGuard,
            permissions_guard_1.PermissionsGuard,
        ],
    })
], AuthModule);
//# sourceMappingURL=auth.module.js.map