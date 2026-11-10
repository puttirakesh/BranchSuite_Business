import { Module } from '@nestjs/common';
import { PlatformAuthModule } from '../auth/platform-auth.module';
import { SupportModule } from '../../support/support.module';
import { PlatformSupportController } from './platform-support.controller';
import { PlatformSupportService } from './platform-support.service';

@Module({
  imports: [PlatformAuthModule, SupportModule],
  controllers: [PlatformSupportController],
  providers: [PlatformSupportService],
})
export class PlatformSupportModule {}
