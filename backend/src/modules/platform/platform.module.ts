
import { Module } from '@nestjs/common';

import { PlatformAuthModule } from './auth/platform-auth.module';

import { PlatformDashboardModule } from './dashboard/platform-dashboard.module';

@Module({
  imports: [
    PlatformAuthModule,
    PlatformDashboardModule,
  ],
})
export class PlatformModule {}
