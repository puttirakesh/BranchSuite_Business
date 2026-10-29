
import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../../prisma/prisma.service';
import { PlatformLoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class PlatformAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: PlatformLoginDto) {
    const email = dto.email.trim().toLowerCase();

    const user = await this.prisma.platformUser.findUnique({
      where: { email },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException(
        'Invalid email or password',
      );
    }

    const passwordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );

    if (!passwordValid) {
      throw new UnauthorizedException(
        'Invalid email or password',
      );
    }

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      role: user.role,
      tokenVersion: user.tokenVersion,
      tokenType: 'platform',
    });

    await this.prisma.platformUser.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      accessToken,
      tokenType: 'Bearer',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }
  
  async logout(userId: string) {
    await this.prisma.platformUser.update({
      where: { id: userId },
      data: {
        tokenVersion: { increment: 1 },
      },
    });

    return {
      message: 'Logged out successfully',
    };
  }

}
