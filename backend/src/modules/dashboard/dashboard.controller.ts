
import {
  Controller,
  Get,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/gaurds/jwt-auth.guard';

import { BusinessScopeGuard } from '../auth/gaurds/business-scope.guard';

import { PermissionsGuard } from '../auth/gaurds/permissions.guard';

import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';

@Controller('dashboard')
@UseGuards(
  JwtAuthGuard,
  BusinessScopeGuard,
  PermissionsGuard,
)
@RequirePermissions('dashboard:read')
export class DashboardController {
  @Get()
  getDashboard() {
    return {
      leads: 0,
      customers: 0,
      openDeals: 0,
      pipelineValue: 0,
      quotesAwaitingResponse: 0,
      currency: 'INR',
      recentActivity: [],
    };
  }
}
