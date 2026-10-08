
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { JwtAuthGuard } from '../auth/gaurds/jwt-auth.guard';
import { BusinessAdminGuard } from '../auth/gaurds/business-admin.guard';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET,
    }),
  ],
  controllers: [CompaniesController],
  providers: [
    CompaniesService,
    JwtAuthGuard,
    BusinessAdminGuard,
  ],
})
export class CompaniesModule {}
