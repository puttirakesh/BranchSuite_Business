import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';

import { CompaniesModule } from './modules/companies/companies.module';
import { BranchesModule } from './modules/branches/branches.module';

import { DashboardModule } from './modules/dashboard/dashboard.module';

@Module({
  imports: [
    PrismaModule,
    UsersModule,
    CompaniesModule,
    BranchesModule,
    AuthModule,
    DashboardModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}