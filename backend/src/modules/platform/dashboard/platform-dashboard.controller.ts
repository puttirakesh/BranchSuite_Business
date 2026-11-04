
import {
  Controller,
  Get,
  UseGuards,
} from '@nestjs/common';

import { PlatformRole } from '@prisma/client';

import { PlatformDashboardService } from './platform-dashboard.service';

import { PlatformJwtGuard } from '../auth/guards/platform-jwt.guard';
import { PlatformRolesGuard } from '../auth/guards/platform-roles.guard';
import { PlatformRoles } from '../auth/decorators/platform-roles.decorator';

@Controller('platform/dashboard')
@UseGuards(PlatformJwtGuard, PlatformRolesGuard)
@PlatformRoles(PlatformRole.PLATFORM_ADMIN)
export class PlatformDashboardController {
  constructor(
    private readonly dashboardService: PlatformDashboardService,
  ) {}

  @Get('summary')
  getSummary() {
    return this.dashboardService.getSummary();
  }
}
