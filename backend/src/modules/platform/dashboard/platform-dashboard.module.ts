
import { Module } from '@nestjs/common';

import { PlatformAuthModule } from '../auth/platform-auth.module';

import { PlatformDashboardController } from './platform-dashboard.controller';
import { PlatformDashboardService } from './platform-dashboard.service';

@Module({
  imports: [PlatformAuthModule],
  controllers: [PlatformDashboardController],
  providers: [PlatformDashboardService],
})
export class PlatformDashboardModule {}
