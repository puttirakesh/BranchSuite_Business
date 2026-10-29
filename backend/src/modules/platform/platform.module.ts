
import { Module } from '@nestjs/common';

import { PlatformAuthModule } from './auth/platform-auth.module';

@Module({
  imports: [PlatformAuthModule],
})
export class PlatformModule {}
