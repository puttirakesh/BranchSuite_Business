
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

type AuthUser = {
  id: string;
  tenantId: string;
  roles: string[];
};

@Injectable()
export class BusinessScopeGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(
    context: ExecutionContext,
  ): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authUser = request.authUser as AuthUser | undefined;

    if (!authUser?.id || !authUser.tenantId) {
      throw new UnauthorizedException('Authentication required');
    }

    const tenantId = request.headers['x-tenant-id'];
    const companyId = request.headers['x-company-id'];
    const branchId = request.headers['x-branch-id'];

    if (
      typeof tenantId !== 'string' ||
      typeof companyId !== 'string' ||
      typeof branchId !== 'string'
    ) {
      throw new ForbiddenException(
        'Tenant, company and branch headers are required',
      );
    }

    if (tenantId !== authUser.tenantId) {
      throw new ForbiddenException('Invalid tenant scope');
    }

    const company = await this.prisma.company.findFirst({
      where: {
        id: companyId,
        tenantId: authUser.tenantId,
        status: 'ACTIVE',
        userAccess: {
          some: { userId: authUser.id },
        },
      },
      select: { id: true },
    });

    if (!company) {
      throw new ForbiddenException(
        'Company access denied',
      );
    }

    const branch = await this.prisma.branch.findFirst({
      where: {
        id: branchId,
        companyId,
        status: 'ACTIVE',
        userAccess: {
          some: { userId: authUser.id },
        },
      },
      select: { id: true },
    });

    if (!branch) {
      throw new ForbiddenException(
        'Branch access denied',
      );
    }

    request.businessScope = {
      tenantId: authUser.tenantId,
      companyId,
      branchId,
    };

    return true;
  }
}
