
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { CreateBranchDto } from './dto/create-branch.dto';

@Injectable()
export class BranchesService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async create(
    tenantId: string,
    actingUserId: string,
    dto: CreateBranchDto,
  ) {
    const name = dto.name.trim();

    if (!name) {
      throw new BadRequestException(
        'Branch name is required',
      );
    }

    const company = await this.prisma.company.findFirst({
      where: {
        id: dto.companyId,
        tenantId,
        status: 'ACTIVE',
        userAccess: {
          some: {
            userId: actingUserId,
          },
        },
      },
    });

    if (!company) {
      throw new NotFoundException(
        'Active company not found or access denied',
      );
    }

    const existing = await this.prisma.branch.findFirst({
      where: {
        companyId: company.id,
        name: {
          equals: name,
          mode: 'insensitive',
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        'Branch already exists in this company',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const branch = await tx.branch.create({
        data: {
          companyId: company.id,
          name,
          status: 'ACTIVE',
        },
      });

      await tx.userBranchAccess.create({
        data: {
          userId: actingUserId,
          branchId: branch.id,
        },
      });

      return branch;
    });
  }

  async findAll(
    tenantId: string,
    actingUserId: string,
    companyId?: string,
  ) {
    return this.prisma.branch.findMany({
      where: {
        ...(companyId && { companyId }),
        company: {
          tenantId,
          userAccess: {
            some: {
              userId: actingUserId,
            },
          },
        },
        userAccess: {
          some: {
            userId: actingUserId,
          },
        },
      },
      select: {
        id: true,
        companyId: true,
        name: true,
        status: true,
        company: {
          select: {
            id: true,
            name: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }
}
