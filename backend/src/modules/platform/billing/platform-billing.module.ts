import { Module } from '@nestjs/common';
import { PlatformAuthModule } from '../auth/platform-auth.module';
import { PlatformBillingController } from './platform-billing.controller';
import { PlatformBillingService } from './platform-billing.service';

@Module({
  imports: [PlatformAuthModule],
  controllers: [PlatformBillingController],
  providers: [PlatformBillingService],
})
export class PlatformBillingModule {}
