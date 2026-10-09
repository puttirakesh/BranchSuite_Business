"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BusinessAdminGuard = void 0;
const common_1 = require("@nestjs/common");
let BusinessAdminGuard = class BusinessAdminGuard {
    canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const roles = request.authUser?.roles ?? [];
        if (!roles.includes('BUSINESS_ADMIN') &&
            !roles.includes('BUSINESS_OWNER')) {
            throw new common_1.ForbiddenException('Business administrator access required');
        }
        return true;
    }
};
exports.BusinessAdminGuard = BusinessAdminGuard;
exports.BusinessAdminGuard = BusinessAdminGuard = __decorate([
    (0, common_1.Injectable)()
], BusinessAdminGuard);
//# sourceMappingURL=business-admin.guard.js.map