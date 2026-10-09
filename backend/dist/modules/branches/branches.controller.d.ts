import { BranchesService } from './branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';
type AuthenticatedRequest = {
    authUser: {
        id: string;
        tenantId: string;
        roles: string[];
    };
};
export declare class BranchesController {
    private readonly branchesService;
    constructor(branchesService: BranchesService);
    create(req: AuthenticatedRequest, dto: CreateBranchDto): Promise<{
        name: string;
        status: import(".prisma/client").$Enums.RecordStatus;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        companyId: string;
    }>;
    findAll(req: AuthenticatedRequest, companyId?: string): Promise<{
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
export {};
