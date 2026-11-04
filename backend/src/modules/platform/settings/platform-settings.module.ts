import { Module } from '@nestjs/common';
import { PlatformAuthModule } from '../auth/platform-auth.module';
import { PlatformSettingsController } from './platform-settings.controller';
import { PlatformSettingsService } from './platform-settings.service';

@Module({
  imports: [PlatformAuthModule],
  controllers: [PlatformSettingsController],
  providers: [PlatformSettingsService],
})
export class PlatformSettingsModule {}
