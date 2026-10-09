
import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { AuthService } from './auth.service';

import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

import { JwtAuthGuard } from './gaurds/jwt-auth.guard';
import { PermissionsGuard } from './gaurds/permissions.guard';
import { BusinessScopeGuard } from './gaurds/business-scope.guard';

import { RequirePermissions } from './decorators/require-permissions.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
  ) {}

  // =====================================================
  // BUSINESS SIGNUP
  // POST /api/v1/auth/signup
  // =====================================================

  @Post('signup')
  signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  // =====================================================
  // LOGIN
  // POST /api/v1/auth/login
  // =====================================================

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  // =====================================================
  // FORGOT PASSWORD
  // POST /api/v1/auth/forgot-password
  // =====================================================

  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  // =====================================================
  // RESET PASSWORD
  // POST /api/v1/auth/reset-password
  // =====================================================

  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  // =====================================================
  // CURRENT USER SESSION
  // GET /api/v1/auth/me
  // =====================================================

  @Get('me')
  me(@Headers('authorization') authorization?: string) {
    return this.authService.me(authorization);
  }

  // =====================================================
  // LOGOUT
  // POST /api/v1/auth/logout
  // =====================================================

  @Post('logout')
  logout() {
    return {
      message: 'Clear the local session and access token',
    };
  }

  // =====================================================
  // DASHBOARD PERMISSION CHECK
  // GET /api/v1/auth/test-dashboard-access
  // =====================================================

  @Get('test-dashboard-access')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('dashboard:read')
  testDashboardAccess() {
    return {
      message: 'Dashboard permission granted',
      permission: 'dashboard:read',
    };
  }

  // =====================================================
  // CRM CREATE PERMISSION CHECK
  // GET /api/v1/auth/test-crm-create
  // =====================================================

  @Get('test-crm-create')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('leads:create')
  testCrmCreate() {
    return {
      message: 'CRM create permission granted',
      permission: 'leads:create',
    };
  }

  // =====================================================
  // BUSINESS SCOPE CHECK
  // GET /api/v1/auth/test-business-scope
  // =====================================================

  @Get('test-business-scope')
  @UseGuards(JwtAuthGuard, BusinessScopeGuard)
  testBusinessScope(
    @Req()
    req: {
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
