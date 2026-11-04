import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RecordStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { ListPlatformCustomersDto } from './dto/list-platform-customers.dto';
import { UpdatePlatformCustomerStatusDto } from './dto/update-platform-customer-status.dto';

@Injectable()
export class PlatformCustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListPlatformCustomersDto) {
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 20);
    if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
      throw new BadRequestException('Invalid pagination parameters');
    }
    const search = query.search?.trim();
    const where: Prisma.TenantWhereInput = {
      ...(query.status ? { status: query.status as RecordStatus } : {}),
      ...(search ? { OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { companies: { some: { name: { contains: search, mode: 'insensitive' } } } },
      ] } : {}),
    };
    const [total, items] = await this.prisma.$transaction([
      this.prisma.tenant.count({ where }),
      this.prisma.tenant.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        select: {
          id: true, name: true, status: true, createdAt: true, updatedAt: true,
          _count: { select: { companies: true, users: true } },
          subscription: { select: { status: true, planId: true, billingCycle: true } },
        },
      }),
    ]);
    return { items: items.map(({ _count, ...item }) => ({
      ...item, companyCount: _count.companies, userCount: _count.users,
    })), page, limit, total, totalPages: Math.ceil(total / limit) };
  }

  async getById(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      select: {
        id: true, name: true, status: true, createdAt: true, updatedAt: true,
        companies: {
          orderBy: { createdAt: 'desc' },
          select: { id: true, name: true, status: true, createdAt: true,
            _count: { select: { branches: true } } },
        },
        _count: { select: { users: true, companies: true } },
        subscription: { select: { id: true, planId: true, billingCycle: true, status: true, createdAt: true, updatedAt: true } },
      },
    });
    if (!tenant) throw new NotFoundException('Business not found');
    const { _count, companies, ...rest } = tenant;
    return { ...rest, userCount: _count.users, companyCount: _count.companies,
      companies: companies.map(({ _count: count, ...company }) => ({ ...company, branchCount: count.branches })) };
  }

  async changeStatus(id: string, dto: UpdatePlatformCustomerStatusDto, actorId: string) {
    if (!Object.values(RecordStatus).includes(dto.status as RecordStatus)) {
      throw new BadRequestException('Invalid business status');
    }
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.tenant.findUnique({ where: { id }, select: { id: true, name: true, status: true } });
      if (!current) throw new NotFoundException('Business not found');
      if (current.status === dto.status) return { ...current, changed: false };
      const updated = await tx.tenant.update({
        where: { id }, data: { status: dto.status as RecordStatus },
        select: { id: true, name: true, status: true },
      });
      await tx.auditEvent.create({ data: {
        tenantId: id, actorId, action: 'PLATFORM_BUSINESS_STATUS_CHANGED', module: 'PLATFORM_CUSTOMERS',
        targetId: id, detail: `Business status: ${current.status} -> ${dto.status}`,
        changes: { before: current.status, after: dto.status, actorType: 'PLATFORM_USER' },
      } });
      return { ...updated, changed: true };
    });
  }
}
