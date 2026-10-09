import { PrismaService } from '../../prisma/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';
export declare class CompaniesService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    create(tenantId: string, actingUserId: string, dto: CreateCompanyDto): Promise<{
        tenantId: string;
        name: string;
        status: import(".prisma/client").$Enums.RecordStatus;
        id: string;
        createdAt: Date;
        updatedAt: Date;
    }>;
    findAll(tenantId: string): Promise<{
        tenantId: string;
        name: string;
        status: import(".prisma/client").$Enums.RecordStatus;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        branches: {
            name: string;
            status: import(".prisma/client").$Enums.RecordStatus;
            id: string;
        }[];
    }[]>;
}
