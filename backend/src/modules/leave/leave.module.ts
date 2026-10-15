
import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

import { LeaveController } from './leave.controller';
import { LeaveService } from './leave.service';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
  ],

  controllers: [
    LeaveController,
  ],

  providers: [
    LeaveService,
  ],

  exports: [
    LeaveService,
  ],
})
export class LeaveModule {}
