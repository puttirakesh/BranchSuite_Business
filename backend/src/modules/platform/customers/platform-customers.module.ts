import { Module } from '@nestjs/common';
import { PlatformAuthModule } from '../auth/platform-auth.module';
import { PlatformCustomersController } from './platform-customers.controller';
import { PlatformCustomersService } from './platform-customers.service';

@Module({
  imports: [PlatformAuthModule],
  controllers: [PlatformCustomersController],
  providers: [PlatformCustomersService],
})
export class PlatformCustomersModule {}
