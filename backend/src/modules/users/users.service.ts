import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async create(dto: CreateUserDto) {
    const email = dto.email.trim().toLowerCase();

    const existingUser =
      await this.prisma.user.findUnique({
        where: {
          email,
        },
      });

    if (existingUser) {
      throw new ConflictException(
        'A user with this email already exists',
      );
    }

    if (dto.tenantId) {
      const tenant =
        await this.prisma.tenant.findUnique({
          where: {
            id: dto.tenantId,
          },
        });

      if (!tenant) {
        throw new NotFoundException(
          'Tenant not found',
        );
      }
    }

    const passwordHash = await bcrypt.hash(
      dto.password,
      12,
    );

    return this.prisma.user.create({
      data: {
        tenantId: dto.tenantId,

        name: dto.name.trim(),

        email,

        password: passwordHash,

        phone: dto.phone?.trim(),

        status: dto.status ?? UserStatus.ACTIVE,
      },

      select: {
        id: true,
        tenantId: true,
        name: true,
        email: true,
        phone: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findAll() {
    return this.prisma.user.findMany({
      orderBy: {
        createdAt: 'desc',
      },

      select: {
        id: true,
        tenantId: true,
        name: true,
        email: true,
        phone: true,
        status: true,

        tenant: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },

        roles: {
          select: {
            role: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },

        companyAccess: {
          select: {
            company: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },

        branchAccess: {
          select: {
            branch: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },

        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findOne(id: string) {
    const user =
      await this.prisma.user.findUnique({
        where: {
          id,
        },

        select: {
          id: true,
          tenantId: true,
          name: true,
          email: true,
          phone: true,
          status: true,

          tenant: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },

          roles: {
            select: {
              role: {
                select: {
                  id: true,
                  name: true,
                  description: true,
                },
              },
            },
          },

          companyAccess: {
            select: {
              company: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },

          branchAccess: {
            select: {
              branch: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },

          createdAt: true,
          updatedAt: true,
        },
      });

    if (!user) {
      throw new NotFoundException(
        'User not found',
      );
    }

    return user;
  }

  async update(
    id: string,
    dto: UpdateUserDto,
  ) {
    await this.findOne(id);

    let email: string | undefined;

    if (dto.email) {
      email = dto.email.trim().toLowerCase();

      const existingUser =
        await this.prisma.user.findUnique({
          where: {
            email,
          },
        });

      if (
        existingUser &&
        existingUser.id !== id
      ) {
        throw new ConflictException(
          'A user with this email already exists',
        );
      }
    }

    if (dto.tenantId) {
      const tenant =
        await this.prisma.tenant.findUnique({
          where: {
            id: dto.tenantId,
          },
        });

      if (!tenant) {
        throw new NotFoundException(
          'Tenant not found',
        );
      }
    }

    return this.prisma.user.update({
      where: {
        id,
      },

      data: {
        ...(dto.tenantId !== undefined && {
          tenantId: dto.tenantId,
        }),

        ...(dto.name !== undefined && {
          name: dto.name.trim(),
        }),

        ...(email !== undefined && {
          email,
        }),

        ...(dto.phone !== undefined && {
          phone: dto.phone.trim(),
        }),

        ...(dto.status !== undefined && {
          status: dto.status,
        }),
      },

      select: {
        id: true,
        tenantId: true,
        name: true,
        email: true,
        phone: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async deactivate(id: string) {
    await this.findOne(id);

    return this.prisma.user.update({
      where: {
        id,
      },

      data: {
        status: UserStatus.INACTIVE,
      },

      select: {
        id: true,
        tenantId: true,
        name: true,
        email: true,
        status: true,
        updatedAt: true,
      },
    });
  }

  async suspend(id: string) {
    await this.findOne(id);

    return this.prisma.user.update({
      where: {
        id,
      },

      data: {
        status: UserStatus.SUSPENDED,
      },

      select: {
        id: true,
        tenantId: true,
        name: true,
        email: true,
        status: true,
        updatedAt: true,
      },
    });
  }

  async activate(id: string) {
    await this.findOne(id);

    return this.prisma.user.update({
      where: {
        id,
      },

      data: {
        status: UserStatus.ACTIVE,
      },

      select: {
        id: true,
        tenantId: true,
        name: true,
        email: true,
        status: true,
        updatedAt: true,
      },
    });
  }
}