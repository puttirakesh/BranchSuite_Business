import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { AssignAccessDto } from './dto/assign-access.dto';
type AuthenticatedRequest = {
    authUser: {
        id: string;
        tenantId: string;
        roles: string[];
    };
};
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    create(req: AuthenticatedRequest, dto: CreateUserDto): Promise<{
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
    findAll(req: AuthenticatedRequest): Promise<{
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
    findOne(req: AuthenticatedRequest, id: string): Promise<{
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
    update(req: AuthenticatedRequest, id: string, dto: UpdateUserDto): Promise<{
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
    activate(req: AuthenticatedRequest, id: string): Promise<{
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
    deactivate(req: AuthenticatedRequest, id: string): Promise<{
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
    suspend(req: AuthenticatedRequest, id: string): Promise<{
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
    assignRole(req: AuthenticatedRequest, id: string, dto: AssignRoleDto): Promise<{
        message: string;
        userId: string;
        role: string;
    }>;
    assignAccess(req: AuthenticatedRequest, id: string, dto: AssignAccessDto): Promise<{
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
export {};
