
import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { PlatformRole } from '@prisma/client';

import { PlatformAuthService } from './platform-auth.service';
import { PlatformLoginDto } from './dto/login.dto';

import {
  PlatformJwtGuard,
  AuthenticatedPlatformUser,
} from './guards/platform-jwt.guard';

import { PlatformRolesGuard } from './guards/platform-roles.guard';
import { PlatformRoles } from './decorators/platform-roles.decorator';

@Controller('platform/auth')
export class PlatformAuthController {
  constructor(
    private readonly platformAuthService: PlatformAuthService,
  ) {}

  // POST /api/v1/platform/auth/login
  @Post('login')
  login(@Body() dto: PlatformLoginDto) {
    return this.platformAuthService.login(dto);
  }

  // GET /api/v1/platform/auth/me
  @Get('me')
  @UseGuards(PlatformJwtGuard, PlatformRolesGuard)
  @PlatformRoles(
    PlatformRole.PLATFORM_ADMIN,
    PlatformRole.PLATFORM_SUPPORT,
  )
  me(
    @Req() request: {
      platformUser: AuthenticatedPlatformUser;
    },
  ) {
    const { id, name, email, role } = request.platformUser;

    return {
      id,
      name,
      email,
      role,
    };
  }

  // POST /api/v1/platform/auth/logout
  @Post('logout')
  @UseGuards(PlatformJwtGuard, PlatformRolesGuard)
  @PlatformRoles(
    PlatformRole.PLATFORM_ADMIN,
    PlatformRole.PLATFORM_SUPPORT,
  )
  logout(
    @Req() request: {
      platformUser: AuthenticatedPlatformUser;
    },
  ) {
    return this.platformAuthService.logout(request.platformUser.id);
  }

  // GET /api/v1/platform/auth/admin-check
// Temporary endpoint for testing role-based access.
@Get('admin-check')
@UseGuards(PlatformJwtGuard, PlatformRolesGuard)
@PlatformRoles(PlatformRole.PLATFORM_ADMIN)
adminCheck(
  @Req() request: {
    platformUser: AuthenticatedPlatformUser;
  },
) {
  return {
    message: 'Platform Admin access granted',
    role: request.platformUser.role,
  };
}
}
