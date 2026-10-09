import { UserStatus } from '@prisma/client';
export declare class CreateUserDto {
    tenantId?: string;
    name: string;
    email: string;
    password: string;
    phone?: string;
    status?: UserStatus;
}
