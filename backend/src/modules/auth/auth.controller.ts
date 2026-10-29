import { OtpDestinationDto, VerifyOtpDto } from './dto/otp.dto';

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

  @Post('signup/otp')
  requestSignupOtp(@Body() dto: OtpDestinationDto) {
    return this.authService.requestSignupOtp(dto);
  }

  @Post('verify-otp')
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
  }

  @Post('signup')
  signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  // =====================================================
  // LOGIN
  // POST /api/v1/auth/login
  // =====================================================

  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: { ip: string }) {
    return this.authService.login(dto, req.ip);
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
  @UseGuards(JwtAuthGuard)
  logout(@Req() req: { authUser: { id: string; tenantId: string } }) {
    return this.authService.logout(req.authUser);
  }

}
