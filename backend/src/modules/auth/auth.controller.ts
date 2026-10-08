import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { RefreshDto } from "./dto/refresh.dto";
import { JwtAuthGuard, AuthenticatedRequest } from "./guards/jwt-auth.guard";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Get("tenants") tenants() {
    return this.auth.tenants();
  }
  @Post("login") login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }
  @Post("refresh") refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }
  @Post("forgot-password") forgot(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto);
  }
  @Post("reset-password") reset(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }
  @Get("me")
  @UseGuards(JwtAuthGuard)
  me(@Req() req: AuthenticatedRequest) {
    return this.auth.me(req.user!);
  }
  @Post("logout")
  @UseGuards(JwtAuthGuard)
  logout(@Req() req: AuthenticatedRequest) {
    return this.auth.logout(req.user!.sid);
  }
}
