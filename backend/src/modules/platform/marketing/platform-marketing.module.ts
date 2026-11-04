import { Module } from '@nestjs/common';
import { PlatformAuthModule } from '../auth/platform-auth.module';
import { PrismaModule } from '../../../prisma/prisma.module';
import { PlatformMarketingController } from './platform-marketing.controller';
import { PlatformMarketingService } from './platform-marketing.service';

@Module({
  imports: [PlatformAuthModule, PrismaModule],
  controllers: [PlatformMarketingController],
  providers: [PlatformMarketingService],
})
export class PlatformMarketingModule {}
