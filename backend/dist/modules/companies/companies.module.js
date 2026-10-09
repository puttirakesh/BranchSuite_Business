"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompaniesModule = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const companies_controller_1 = require("./companies.controller");
const companies_service_1 = require("./companies.service");
const jwt_auth_guard_1 = require("../auth/gaurds/jwt-auth.guard");
const business_admin_guard_1 = require("../auth/gaurds/business-admin.guard");
let CompaniesModule = class CompaniesModule {
};
exports.CompaniesModule = CompaniesModule;
exports.CompaniesModule = CompaniesModule = __decorate([
    (0, common_1.Module)({
        imports: [
            jwt_1.JwtModule.register({
                secret: process.env.JWT_SECRET,
            }),
        ],
        controllers: [companies_controller_1.CompaniesController],
        providers: [
            companies_service_1.CompaniesService,
            jwt_auth_guard_1.JwtAuthGuard,
            business_admin_guard_1.BusinessAdminGuard,
        ],
    })
], CompaniesModule);
//# sourceMappingURL=companies.module.js.map