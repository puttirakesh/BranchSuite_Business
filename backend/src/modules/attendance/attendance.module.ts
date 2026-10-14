import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../auth/gaurds/jwt-auth.guard';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';

@Module({
  imports: [JwtModule.register({ secret: process.env.JWT_SECRET })],
  controllers: [AttendanceController],
  providers: [AttendanceService, JwtAuthGuard],
  exports: [AttendanceService],
})
export class AttendanceModule {}
