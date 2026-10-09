import { PrismaService } from '../../prisma/prisma.service';
import { CreateBranchDto } from './dto/create-branch.dto';
export declare class BranchesService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    create(tenantId: string, actingUserId: string, dto: CreateBranchDto): Promise<{
        name: string;
        status: import(".prisma/client").$Enums.RecordStatus;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        companyId: string;
    }>;
    findAll(tenantId: string, actingUserId: string, companyId?: string): Promise<{
        company: {
            name: string;
            id: string;
        };
        name: string;
        status: import(".prisma/client").$Enums.RecordStatus;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        companyId: string;
    }[]>;
}
