import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { PrismaModule } from '../../prisma/prisma.module';
import { JwtAuthGuard } from '../auth/gaurds/jwt-auth.guard';
import { PermissionsGuard } from '../auth/gaurds/permissions.guard';

import { LeaveController } from './leave.controller';
import { LeaveService } from './leave.service';

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({}),
  ],
  controllers: [LeaveController],
  providers: [
    LeaveService,
    JwtAuthGuard,
    PermissionsGuard,
  ],
  exports: [LeaveService],
})
export class LeaveModule {}