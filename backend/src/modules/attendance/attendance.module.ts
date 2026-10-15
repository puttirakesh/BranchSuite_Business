
import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { AttendanceCorrectionsService } from './attendance-corrections.service';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
  ],

  controllers: [
    AttendanceController,
  ],

  providers: [
    AttendanceService,
    AttendanceCorrectionsService,
  ],

  exports: [
    AttendanceService,
    AttendanceCorrectionsService,
  ],
})
export class AttendanceModule {}
