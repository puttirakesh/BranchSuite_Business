import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
type AuthenticatedRequest = {
    authUser: {
        id: string;
        tenantId: string;
        roles: string[];
    };
};
export declare class CompaniesController {
    private readonly companiesService;
    constructor(companiesService: CompaniesService);
    create(req: AuthenticatedRequest, dto: CreateCompanyDto): Promise<{
        tenantId: string;
        name: string;
        status: import(".prisma/client").$Enums.RecordStatus;
        id: string;
        createdAt: Date;
        updatedAt: Date;
    }>;
    findAll(req: AuthenticatedRequest): Promise<{
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
export {};
