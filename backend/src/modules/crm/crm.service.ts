
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RecordStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';

export interface CrmAuthUser {
  id: string;
  tenantId: string;
  roles: string[];
}

export interface ListCustomersQuery {
  companyId?: string;
  branchId?: string;
  search?: string;
  page?: number;
  limit?: number;
  status?: RecordStatus;
}

export interface UpdateCustomerData {
  name?: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  branchId?: string | null;
}

@Injectable()
export class CrmService {
  constructor(private readonly prisma: PrismaService) {}

  private isBusinessAdmin(user: CrmAuthUser): boolean {
    return (
      user.roles.includes('BUSINESS_OWNER') ||
      user.roles.includes('BUSINESS_ADMIN')
    );
  }

  private async checkCompanyAccess(
    user: CrmAuthUser,
    companyId: string,
  ): Promise<void> {
    const company = await this.prisma.company.findFirst({
      where: {
        id: companyId,
        tenantId: user.tenantId,
        status: 'ACTIVE',
      },
      select: { id: true },
    });

    if (!company) {
      throw new NotFoundException(
        'Company not found or inactive',
      );
    }

    if (this.isBusinessAdmin(user)) {
      return;
    }

    const access = await this.prisma.userCompanyAccess.findUnique({
      where: {
        userId_companyId: {
          userId: user.id,
          companyId,
        },
      },
    });

    if (!access) {
      throw new ForbiddenException(
        'You do not have access to this company',
      );
    }
  }

  private async checkBranchAccess(
    user: CrmAuthUser,
    companyId: string,
    branchId: string,
  ): Promise<void> {
    const branch = await this.prisma.branch.findFirst({
      where: {
        id: branchId,
        companyId,
        status: 'ACTIVE',
      },
      select: { id: true },
    });

    if (!branch) {
      throw new NotFoundException(
        'Branch not found in this company or inactive',
      );
    }

    if (this.isBusinessAdmin(user)) {
      return;
    }

    const access = await this.prisma.userBranchAccess.findUnique({
      where: {
        userId_branchId: {
          userId: user.id,
          branchId,
        },
      },
    });

    if (!access) {
      throw new ForbiddenException(
        'You do not have access to this branch',
      );
    }
  }

  private async checkCustomerAccess(
    user: CrmAuthUser,
    customerId: string,
  ) {
    const customer = await this.prisma.customer.findFirst({
      where: {
        id: customerId,
        tenantId: user.tenantId,
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    await this.checkCompanyAccess(user, customer.companyId);

    if (customer.branchId) {
      await this.checkBranchAccess(
        user,
        customer.companyId,
        customer.branchId,
      );
    } else if (!this.isBusinessAdmin(user)) {
      throw new ForbiddenException(
        'Company-level customers require business administrator access',
      );
    }

    return customer;
  }

  async create(
    user: CrmAuthUser,
    dto: CreateCustomerDto,
  ) {
    if (!dto.name?.trim()) throw new BadRequestException('Customer name is required');
    await this.checkCompanyAccess(user, dto.companyId);

    if (dto.branchId) {
      await this.checkBranchAccess(
        user,
        dto.companyId,
        dto.branchId,
      );
    } else if (!this.isBusinessAdmin(user)) {
      throw new ForbiddenException(
        'A branch is required for your role',
      );
    }

    return this.prisma.customer.create({
      data: {
        tenantId: user.tenantId,
        companyId: dto.companyId,
        branchId: dto.branchId ?? null,
        name: dto.name.trim(),
        email: dto.email?.trim().toLowerCase() ?? null,
        phone: dto.phone?.trim() ?? null,
        address: dto.address?.trim() ?? null,
        notes: dto.notes?.trim() ?? null,
        createdById: user.id,
      },
    });
  }

  async findAll(
    user: CrmAuthUser,
    query: ListCustomersQuery,
  ) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(
      100,
      Math.max(1, Number(query.limit) || 20),
    );

    const where: Prisma.CustomerWhereInput = {
      tenantId: user.tenantId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.companyId
        ? { companyId: query.companyId }
        : {}),
      ...(query.branchId
        ? { branchId: query.branchId }
        : {}),
      ...(query.search?.trim()
        ? {
            OR: [
              {
                name: {
                  contains: query.search.trim(),
                  mode: 'insensitive',
                },
              },
              {
                email: {
                  contains: query.search.trim(),
                  mode: 'insensitive',
                },
              },
              {
                phone: {
                  contains: query.search.trim(),
                },
              },
            ],
          }
        : {}),
    };

    if (!this.isBusinessAdmin(user)) {
      const [companyAccess, branchAccess] = await Promise.all([
        this.prisma.userCompanyAccess.findMany({
          where: { userId: user.id },
          select: { companyId: true },
        }),
        this.prisma.userBranchAccess.findMany({
          where: { userId: user.id },
          select: { branchId: true },
        }),
      ]);

      where.AND = [
        { companyId: { in: companyAccess.map((item) => item.companyId) } },
        { branchId: { in: branchAccess.map((item) => item.branchId) } },
      ];
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.customer.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(
    user: CrmAuthUser,
    id: string,
  ) {
    return this.checkCustomerAccess(user, id);
  }

  async update(
    user: CrmAuthUser,
    id: string,
    dto: UpdateCustomerData,
  ) {
    if (dto.name !== undefined && (typeof dto.name !== 'string' || !dto.name.trim())) throw new BadRequestException('Customer name is required');
    const customer = await this.checkCustomerAccess(user, id);

    if (dto.branchId !== undefined) {
      if (dto.branchId === null) {
        if (!this.isBusinessAdmin(user)) {
          throw new ForbiddenException(
            'Only business administrators can remove branch assignment',
          );
        }
      } else {
        await this.checkBranchAccess(
          user,
          customer.companyId,
          dto.branchId,
        );
      }
    }

    return this.prisma.customer.update({
      where: { id: customer.id },
      data: {
        ...(dto.name !== undefined
          ? { name: dto.name.trim() }
          : {}),
        ...(dto.email !== undefined
          ? {
              email: dto.email?.trim().toLowerCase() ?? null,
            }
          : {}),
        ...(dto.phone !== undefined
          ? { phone: dto.phone?.trim() ?? null }
          : {}),
        ...(dto.address !== undefined
          ? { address: dto.address?.trim() ?? null }
          : {}),
        ...(dto.notes !== undefined
          ? { notes: dto.notes?.trim() ?? null }
          : {}),
        ...(dto.branchId !== undefined
          ? { branchId: dto.branchId }
          : {}),
      },
    });
  }

  async changeStatus(
    user: CrmAuthUser,
    id: string,
    status: RecordStatus,
  ) {
    const customer = await this.checkCustomerAccess(user, id);

    if (!['ACTIVE', 'INACTIVE'].includes(status)) {
      throw new BadRequestException('Invalid customer status');
    }

    return this.prisma.customer.update({
      where: { id: customer.id },
      data: { status },
    });
  }
}
