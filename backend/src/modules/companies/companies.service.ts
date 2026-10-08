
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    tenantId: string,
    actingUserId: string,
    dto: CreateCompanyDto,
  ) {
    const name = dto.name.trim();

    if (!name) {
      throw new BadRequestException(
        'Company name is required',
      );
    }

    const existing = await this.prisma.company.findFirst({
      where: {
        tenantId,
        name: {
          equals: name,
          mode: 'insensitive',
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        'Company already exists in this tenant',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          tenantId,
          name,
          status: 'ACTIVE',
        },
      });

      await tx.userCompanyAccess.create({
        data: {
          userId: actingUserId,
          companyId: company.id,
        },
      });

      return company;
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.company.findMany({
      where: { tenantId },
      select: {
        id: true,
        tenantId: true,
        name: true,
        status: true,
        branches: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}
