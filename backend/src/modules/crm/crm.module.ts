
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

// Customers
import { CrmController } from './crm.controller';
import { CrmService } from './crm.service';

// Leads
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';

// Activities
import { ActivitiesController } from './activities.controller';
import { ActivitiesService } from './activities.service';

// Authentication and permissions
import { JwtAuthGuard } from '../auth/gaurds/jwt-auth.guard';
import { PermissionsGuard } from '../auth/gaurds/permissions.guard';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET,
    }),
  ],

  controllers: [
    CrmController,
    LeadsController,
    ActivitiesController,
  ],

  providers: [
    CrmService,
    LeadsService,
    ActivitiesService,
    JwtAuthGuard,
    PermissionsGuard,
  ],

  exports: [
    CrmService,
    LeadsService,
    ActivitiesService,
  ],
})
export class CrmModule {}
