"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BranchesModule = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const branches_controller_1 = require("./branches.controller");
const branches_service_1 = require("./branches.service");
const jwt_auth_guard_1 = require("../auth/gaurds/jwt-auth.guard");
const business_admin_guard_1 = require("../auth/gaurds/business-admin.guard");
let BranchesModule = class BranchesModule {
};
exports.BranchesModule = BranchesModule;
exports.BranchesModule = BranchesModule = __decorate([
    (0, common_1.Module)({
        imports: [
            jwt_1.JwtModule.register({
                secret: process.env.JWT_SECRET,
            }),
        ],
        controllers: [branches_controller_1.BranchesController],
        providers: [
            branches_service_1.BranchesService,
            jwt_auth_guard_1.JwtAuthGuard,
            business_admin_guard_1.BusinessAdminGuard,
        ],
    })
], BranchesModule);
//# sourceMappingURL=branches.module.js.map