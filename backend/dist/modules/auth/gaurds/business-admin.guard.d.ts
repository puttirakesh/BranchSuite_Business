import { CanActivate, ExecutionContext } from '@nestjs/common';
export declare class BusinessAdminGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean;
}
