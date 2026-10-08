
import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Req,
} from '@nestjs/common';

import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';


import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './gaurds/jwt-auth.guard';
import { PermissionsGuard } from './gaurds/permissions.guard';
import { BusinessScopeGuard } from './gaurds/business-scope.guard';

import { RequirePermissions } from './decorators/require-permissions.decorator';




@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
  ) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('me')
  me(@Headers('authorization') authorization?: string) {
    return this.authService.me(authorization);
  }

  @Post('logout')
  logout() {
    return {
      message: 'Clear the local session and access token',
    };
  }

  
  @Get('test-dashboard-access')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('dashboard:read')
  testDashboardAccess() {
    return {
      message: 'Dashboard permission granted',
      permission: 'dashboard:read',
    };
  }

  @Get('test-crm-create')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('leads:create')
  testCrmCreate() {
    return {
      message: 'CRM create permission granted',
      permission: 'leads:create',
    };
  }

  
  @Get('test-business-scope')
  @UseGuards(JwtAuthGuard, BusinessScopeGuard)
  testBusinessScope(
    @Req() req: {
      businessScope: {
        tenantId: string;
        companyId: string;
        branchId: string;
      };
    },
  ) {
    return {
      message: 'Business scope validated',
      scope: req.businessScope,
    };
  }


}
