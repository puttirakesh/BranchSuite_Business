import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { LoginType } from './enums/login-type.enum';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        id: dto.tenantId,
        status: 'ACTIVE',
      },
    });

    if (!tenant) {
      throw new BadRequestException('Selected business does not exist');
    }

    const user = await this.prisma.user.findUnique({
      where: {
        email: dto.email.toLowerCase(),
      },

      include: {
        roles: {
          include: {
            role: true,
          },
        },

        companyAccess: {
          include: {
            company: true,
          },
        },

        branchAccess: {
          include: {
            branch: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Your account is not active');
    }

    if (user.tenantId !== dto.tenantId) {
      throw new UnauthorizedException(
        'This account does not belong to the selected business',
      );
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.password,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const roleNames = user.roles.map((item) => item.role.name);

    this.validateLoginType(dto.loginType, roleNames);

    const payload = {
      sub: user.id,
      tenantId: user.tenantId,
      email: user.email,
      roles: roleNames,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    return {
      message: 'Login successful',

      accessToken,

      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        status: user.status,
        tenantId: user.tenantId,
        roles: roleNames,

        companies: user.companyAccess.map((item) => ({
          id: item.company.id,
          name: item.company.name,
        })),

        branches: user.branchAccess.map((item) => ({
          id: item.branch.id,
          name: item.branch.name,
        })),
      },
    };
  }

  private validateLoginType(
    loginType: LoginType,
    roles: string[],
  ) {
    const businessRoles = [
      'BUSINESS_OWNER',
      'BUSINESS_ADMIN',
    ];

    const employeeRoles = [
      'EMPLOYEE',
      'HR_MANAGER',
      'PAYROLL_MANAGER',
      'BRANCH_MANAGER',
      'SALES_MANAGER',
    ];

    if (loginType === LoginType.BUSINESS) {
      const allowed = roles.some((role) =>
        businessRoles.includes(role),
      );

      if (!allowed) {
        throw new UnauthorizedException(
          'This account cannot use Business sign in',
        );
      }
    }

    if (loginType === LoginType.EMPLOYEE) {
      const allowed = roles.some((role) =>
        employeeRoles.includes(role),
      );

      if (!allowed) {
        throw new UnauthorizedException(
          'This account cannot use Employee sign in',
        );
      }
    }
  }
}