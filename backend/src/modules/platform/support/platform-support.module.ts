import { Module } from '@nestjs/common';
import { PlatformAuthModule } from '../auth/platform-auth.module';
import { PlatformSupportController } from './platform-support.controller';
import { PlatformSupportService } from './platform-support.service';

@Module({
  imports: [PlatformAuthModule],
  controllers: [PlatformSupportController],
  providers: [PlatformSupportService],
})
export class PlatformSupportModule {}
