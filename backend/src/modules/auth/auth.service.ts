
import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  private readonly userInclude = {
    tenant: true,
    roles: {
      include: {
        role: {
          include: {
            permissions: {
              include: { permission: true },
            },
          },
        },
      },
    },
    companyAccess: {
      include: { company: true },
    },
    branchAccess: {
      include: { branch: true },
    },
  } as const;

  private async getActiveUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: this.userInclude,
    });

    if (
      !user ||
      user.status !== 'ACTIVE' ||
      !user.tenantId ||
      user.tenant?.status !== 'ACTIVE'
    ) {
      throw new UnauthorizedException(
        'Invalid or inactive account',
      );
    }

    return user;
  }

  private makeSession(
    user: Awaited<ReturnType<typeof this.getActiveUser>>,
  ) {
    const roles = user.roles.map((r) => r.role.name);

    const permissions = [
      ...new Set(
        user.roles.flatMap((r) =>
          r.role.permissions.map(
            (p) => p.permission.key,
          ),
        ),
      ),
    ];

    const memberships = user.companyAccess
      .filter(
        ({ company }) =>
          company.status === 'ACTIVE' &&
          company.tenantId === user.tenantId,
      )
      .map(({ company }) => ({
        id: `${user.id}:${company.id}`,
        tenantId: user.tenantId!,
        companyId: company.id,
        companyName: company.name,
        role: roles.includes('BUSINESS_OWNER')
          ? 'BUSINESS_OWNER'
          : roles.includes('BUSINESS_ADMIN')
            ? 'BUSINESS_ADMIN'
            : roles.includes('EMPLOYEE')
              ? 'EMPLOYEE'
              : roles[0] ?? 'EMPLOYEE',
        permissions,
        branches: user.branchAccess
          .filter(
            ({ branch }) =>
              branch.companyId === company.id &&
              branch.status === 'ACTIVE',
          )
          .map(({ branch }) => ({
            id: branch.id,
            name: branch.name,
          })),
      }));

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      memberships,
    };
  }

  async login(dto: LoginDto) {
    const account = await this.prisma.user.findUnique({
      where: {
        email: dto.email.trim().toLowerCase(),
      },
    });

    if (!account) {
      throw new UnauthorizedException(
        'Invalid email or password',
      );
    }

    const passwordValid = await bcrypt.compare(
      dto.password,
      account.password,
    );

    if (!passwordValid || account.status !== 'ACTIVE') {
      throw new UnauthorizedException(
        'Invalid email or password',
      );
    }

    const user = await this.getActiveUser(account.id);

    if (dto.tenantId && dto.tenantId !== user.tenantId) {
      throw new UnauthorizedException(
        'Invalid email or password',
      );
    }

    const roles = user.roles.map((r) => r.role.name);

    const employeeOnly =
      roles.includes('EMPLOYEE') &&
      !roles.some((r) =>
        [
          'BUSINESS_OWNER',
          'BUSINESS_ADMIN',
          'HR_MANAGER',
          'PAYROLL_MANAGER',
          'BRANCH_MANAGER',
          'SALES_MANAGER',
          'MANAGER',
          'SALES',
          'HR',
          'PAYROLL',
        ].includes(r),
      );

    if (
      (dto.portal === 'employee' && !employeeOnly) ||
      (dto.portal === 'staff' && employeeOnly)
    ) {
      throw new UnauthorizedException(
        'This account cannot access the selected portal',
      );
    }

    const session = this.makeSession(user);

    if (
      !session.memberships.some(
        (membership) => membership.branches.length > 0,
      )
    ) {
      throw new UnauthorizedException(
        'No active company or branch access assigned',
      );
    }

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      tenantId: user.tenantId,
    });

    return {
      message: 'Login successful',
      accessToken,
      session,
    };
  }

  async me(authorization?: string) {
    const token = authorization?.startsWith('Bearer ')
      ? authorization.slice(7).trim()
      : '';

    if (!token) {
      throw new UnauthorizedException(
        'Missing access token',
      );
    }

    let payload: {
      sub?: string;
      tenantId?: string;
    };

    try {
      payload = await this.jwtService.verifyAsync(token);
    } catch {
      throw new UnauthorizedException(
        'Invalid or expired access token',
      );
    }

    if (!payload.sub || !payload.tenantId) {
      throw new UnauthorizedException(
        'Invalid access token',
      );
    }

    const user = await this.getActiveUser(payload.sub);

    if (user.tenantId !== payload.tenantId) {
      throw new UnauthorizedException(
        'Invalid access token',
      );
    }

    return this.makeSession(user);
  }
}
