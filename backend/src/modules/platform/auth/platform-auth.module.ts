
import 'dotenv/config';

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { PlatformAuthController } from './platform-auth.controller';
import { PlatformAuthService } from './platform-auth.service';
import { PlatformJwtGuard } from './guards/platform-jwt.guard';
import { PlatformRolesGuard } from './guards/platform-roles.guard';

const platformJwtSecret = process.env.PLATFORM_JWT_SECRET;

if (!platformJwtSecret || platformJwtSecret.length < 32) {
  throw new Error(
    'PLATFORM_JWT_SECRET must contain at least 32 characters',
  );
}

@Module({
  imports: [
    JwtModule.register({
      secret: platformJwtSecret,
      signOptions: {
        expiresIn: '8h',
        issuer: 'branchsuite-platform',
        audience: 'branchsuite-superadmin',
        algorithm: 'HS256',
      },
      verifyOptions: {
        issuer: 'branchsuite-platform',
        audience: 'branchsuite-superadmin',
        algorithms: ['HS256'],
      },
    }),
  ],
  controllers: [PlatformAuthController],
  providers: [
    PlatformAuthService,
    PlatformJwtGuard,
    PlatformRolesGuard,
  ],
  exports: [JwtModule, PlatformJwtGuard, PlatformRolesGuard],
})
export class PlatformAuthModule {}
