import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}