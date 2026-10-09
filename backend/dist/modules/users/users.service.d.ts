import { UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
export declare class UsersService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private ensureUser;
    create(tenantId: string, dto: CreateUserDto): Promise<{
        tenantId: string | null;
        name: string;
        email: string;
        phone: string | null;
        status: import(".prisma/client").$Enums.UserStatus;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        roles: {
            role: {
                name: string;
                id: string;
            };
        }[];
        companyAccess: {
            company: {
                name: string;
                id: string;
            };
        }[];
        branchAccess: {
            branch: {
                name: string;
                id: string;
            };
        }[];
    }>;
    findAll(tenantId: string): Promise<{
        tenantId: string | null;
        name: string;
        email: string;
        phone: string | null;
        status: import(".prisma/client").$Enums.UserStatus;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        roles: {
            role: {
                name: string;
                id: string;
            };
        }[];
        companyAccess: {
            company: {
                name: string;
                id: string;
            };
        }[];
        branchAccess: {
            branch: {
                name: string;
                id: string;
            };
        }[];
    }[]>;
    findOne(tenantId: string, id: string): Promise<{
        tenantId: string | null;
        name: string;
        email: string;
        phone: string | null;
        status: import(".prisma/client").$Enums.UserStatus;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        roles: {
            role: {
                name: string;
                id: string;
            };
        }[];
        companyAccess: {
            company: {
                name: string;
                id: string;
            };
        }[];
        branchAccess: {
            branch: {
                name: string;
                id: string;
            };
        }[];
    }>;
    update(tenantId: string, id: string, dto: UpdateUserDto): Promise<{
        tenantId: string | null;
        name: string;
        email: string;
        phone: string | null;
        status: import(".prisma/client").$Enums.UserStatus;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        roles: {
            role: {
                name: string;
                id: string;
            };
        }[];
        companyAccess: {
            company: {
                name: string;
                id: string;
            };
        }[];
        branchAccess: {
            branch: {
                name: string;
                id: string;
            };
        }[];
    }>;
    changeStatus(tenantId: string, id: string, status: UserStatus, actingUserId: string): Promise<{
        tenantId: string | null;
        name: string;
        email: string;
        phone: string | null;
        status: import(".prisma/client").$Enums.UserStatus;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        roles: {
            role: {
                name: string;
                id: string;
            };
        }[];
        companyAccess: {
            company: {
                name: string;
                id: string;
            };
        }[];
        branchAccess: {
            branch: {
                name: string;
                id: string;
            };
        }[];
    }>;
    assignEmployeeRole(tenantId: string, userId: string, actingUserId: string): Promise<{
        message: string;
        userId: string;
        role: string;
    }>;
    assignAccess(tenantId: string, userId: string, companyId: string, branchIds: string[]): Promise<{
        message: string;
        userId: string;
        company: {
            name: string;
            id: string;
        };
        branches: {
            name: string;
            id: string;
        }[];
    }>;
}
