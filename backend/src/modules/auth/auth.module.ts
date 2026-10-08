
import 'dotenv/config';

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

import { JwtAuthGuard } from './gaurds/jwt-auth.guard';
import { BusinessAdminGuard } from './gaurds/business-admin.guard';
import { PermissionsGuard } from './gaurds/permissions.guard';
import { BusinessScopeGuard } from './gaurds/business-scope.guard';

const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error(
    'JWT_SECRET must contain at least 32 characters',
  );
}

@Module({
  imports: [
    JwtModule.register({
      secret: jwtSecret,
      signOptions: {
        expiresIn: '1d',
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtAuthGuard,
    BusinessAdminGuard,
    PermissionsGuard,
    BusinessScopeGuard,
  ],
  exports: [
    JwtModule,
    JwtAuthGuard,
    BusinessAdminGuard,
    PermissionsGuard,
  ],
})
export class AuthModule {}
