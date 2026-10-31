import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { PlatformRole } from '@prisma/client';
import { PlatformJwtGuard, AuthenticatedPlatformUser } from '../auth/guards/platform-jwt.guard';
import { PlatformRolesGuard } from '../auth/guards/platform-roles.guard';
import { PlatformRoles } from '../auth/decorators/platform-roles.decorator';
import { PlatformSupportService } from './platform-support.service';
import { CreatePlatformTicketReplyDto, ListPlatformTicketsDto, UpdatePlatformTicketPriorityDto, UpdatePlatformTicketStatusDto } from './dto/support.dto';

type PlatformRequest = { platformUser: AuthenticatedPlatformUser };

@Controller('platform/support')
@UseGuards(PlatformJwtGuard, PlatformRolesGuard)
@PlatformRoles(PlatformRole.PLATFORM_ADMIN, PlatformRole.PLATFORM_SUPPORT)
export class PlatformSupportController {
  constructor(private readonly service: PlatformSupportService) {}

  @Get('summary')
  summary() { return this.service.summary(); }

  @Get('tickets')
  list(@Query() query: ListPlatformTicketsDto) { return this.service.list(query); }

  @Get('tickets/:id')
  detail(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) { return this.service.detail(id); }

  @Post('tickets/:id/replies')
  reply(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Body() dto: CreatePlatformTicketReplyDto, @Req() req: PlatformRequest) {
    return this.service.reply(id, dto, req.platformUser);
  }

  @Patch('tickets/:id/status')
  @PlatformRoles(PlatformRole.PLATFORM_ADMIN)
  status(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Body() dto: UpdatePlatformTicketStatusDto, @Req() req: PlatformRequest) {
    return this.service.updateStatus(id, dto, req.platformUser);
  }

  @Patch('tickets/:id/priority')
  @PlatformRoles(PlatformRole.PLATFORM_ADMIN)
  priority(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Body() dto: UpdatePlatformTicketPriorityDto, @Req() req: PlatformRequest) {
    return this.service.updatePriority(id, dto, req.platformUser);
  }
}
