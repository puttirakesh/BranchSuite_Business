
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../../../prisma/prisma.service';
import { PlatformRole } from '@prisma/client';

interface PlatformJwtPayload {
  sub?: string;
  role?: PlatformRole;
  tokenVersion?: number;
  tokenType?: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedPlatformUser {
  id: string;
  name: string;
  email: string;
  role: PlatformRole;
  tokenVersion: number;
}

@Injectable()
export class PlatformJwtGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(
    context: ExecutionContext,
  ): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      platformUser?: AuthenticatedPlatformUser;
    }>();

    const authorization = request.headers.authorization;

    if (
      typeof authorization !== 'string' ||
      !/^Bearer\s+\S+$/i.test(authorization)
    ) {
      throw new UnauthorizedException('Missing or invalid access token');
    }

    const token = authorization.replace(/^Bearer\s+/i, '');

    let payload: PlatformJwtPayload;

    try {
      payload =
        await this.jwtService.verifyAsync<PlatformJwtPayload>(
          token,
          {
            issuer: 'branchsuite-platform',
            audience: 'branchsuite-superadmin',
            algorithms: ['HS256'],
          },
        );
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    if (
      payload.tokenType !== 'platform' ||
      typeof payload.sub !== 'string' ||
      !payload.sub ||
      typeof payload.tokenVersion !== 'number' ||
      !Number.isSafeInteger(payload.tokenVersion) ||
      payload.tokenVersion < 0 ||
      !Object.values(PlatformRole).includes(
        payload.role as PlatformRole,
      )
    ) {
      throw new UnauthorizedException('Invalid platform token');
    }

    const user = await this.prisma.platformUser.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        tokenVersion: true,
      },
    });

    if (
      !user ||
      user.status !== 'ACTIVE' ||
      user.tokenVersion !== payload.tokenVersion ||
      user.role !== payload.role
    ) {
      throw new UnauthorizedException(
        'Platform account is inactive or session has expired',
      );
    }

    request.platformUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion,
    };

    return true;
  }
}
