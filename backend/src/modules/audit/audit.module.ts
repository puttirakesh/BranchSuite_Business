import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/gaurds/jwt-auth.guard';
import { BusinessAdminGuard } from '../auth/gaurds/business-admin.guard';

@Global()
@Module({
  imports: [JwtModule.register({ secret: process.env.JWT_SECRET })],
  controllers: [AuditController],
  providers: [AuditService, JwtAuthGuard, BusinessAdminGuard],
  exports: [AuditService],
})
export class AuditModule {}
