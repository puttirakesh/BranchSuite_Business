import { UserStatus } from '@prisma/client';
export declare class UpdateUserDto {
    tenantId?: string;
    name?: string;
    email?: string;
    phone?: string;
    status?: UserStatus;
}
