import { Module } from '@nestjs/common';
import { PlatformAuthModule } from '../auth/platform-auth.module';
import { PlatformAuditController } from './platform-audit.controller';
import { PlatformAuditService } from './platform-audit.service';

@Module({
  imports: [PlatformAuthModule],
  controllers: [PlatformAuditController],
  providers: [PlatformAuditService],
})
export class PlatformAuditModule {}
