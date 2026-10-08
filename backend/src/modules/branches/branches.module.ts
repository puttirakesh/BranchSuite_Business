
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { BranchesController } from './branches.controller';
import { BranchesService } from './branches.service';


import { JwtAuthGuard } from '../auth/gaurds/jwt-auth.guard';
import { BusinessAdminGuard } from '../auth/gaurds/business-admin.guard';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET,
    }),
  ],
  controllers: [BranchesController],
  providers: [
    BranchesService,
    JwtAuthGuard,
    BusinessAdminGuard,
  ],
})
export class BranchesModule {}
