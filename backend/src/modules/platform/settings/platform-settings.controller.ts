import { BadRequestException, Body, Controller, Get, ParseIntPipe, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { PlatformRole } from '@prisma/client';
import { PlatformJwtGuard, AuthenticatedPlatformUser } from '../auth/guards/platform-jwt.guard';
import { PlatformRolesGuard } from '../auth/guards/platform-roles.guard';
import { PlatformRoles } from '../auth/decorators/platform-roles.decorator';
import { UpdatePlatformSettingsDto } from './dto/update-platform-settings.dto';
import { PlatformSettingsService } from './platform-settings.service';

@Controller('platform/settings')
@UseGuards(PlatformJwtGuard, PlatformRolesGuard)
@PlatformRoles(PlatformRole.PLATFORM_ADMIN)
export class PlatformSettingsController {
  constructor(private readonly settings: PlatformSettingsService) {}

  @Get('general')
  getGeneral() { return this.settings.getGeneral(); }

  @Patch('general')
  updateGeneral(@Body() dto: UpdatePlatformSettingsDto, @Req() req: { platformUser: AuthenticatedPlatformUser }) {
    return this.settings.updateGeneral(dto, req.platformUser.id);
  }

  @Get('history')
  history(@Query('page', new ParseIntPipe({ optional: true })) page = 1, @Query('limit', new ParseIntPipe({ optional: true })) limit = 20) {
    if (page < 1 || limit < 1 || limit > 100 || !Number.isSafeInteger(page) || !Number.isSafeInteger(limit)) {
      throw new BadRequestException('page must be positive and limit must be 1..100');
    }
    return this.settings.history(page, limit);
  }
}
