
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(
    context: ExecutionContext,
  ): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const authorization = request.headers.authorization;
    const [scheme, token] = authorization?.split(' ') ?? [];

    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Missing access token');
    }

    let payload: { sub?: string; tenantId?: string };

    try {
      payload = await this.jwtService.verifyAsync(token);
    } catch {
      throw new UnauthorizedException(
        'Invalid or expired access token',
      );
    }

    if (!payload.sub || !payload.tenantId) {
      throw new UnauthorizedException('Invalid access token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        tenant: true,
        roles: { include: { role: true } },
      },
    });

    if (
      !user ||
      user.status !== 'ACTIVE' ||
      user.tenantId !== payload.tenantId ||
      user.tenant?.status !== 'ACTIVE'
    ) {
      throw new UnauthorizedException('Account is not active');
    }

    request.authUser = {
      id: user.id,
      tenantId: user.tenantId,
      roles: user.roles.map(({ role }) => role.name),
    };

    return true;
  }
}
