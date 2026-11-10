import { SupportOperations } from '../../support/support-operations.service';
import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { PlatformRole } from '@prisma/client';
import { PlatformJwtGuard, AuthenticatedPlatformUser } from '../auth/guards/platform-jwt.guard';
import { PlatformRolesGuard } from '../auth/guards/platform-roles.guard';
import { PlatformRoles } from '../auth/decorators/platform-roles.decorator';
import { PlatformSupportService } from './platform-support.service';
import { AssignSupportDto, SupportRevisionDto, EscalateSupportDto, ManageEscalationDto, ReadSupportDto, SupportBusinessesDto, CreatePlatformTicketReplyDto, ListPlatformTicketsDto, UpdatePlatformTicketPriorityDto, UpdatePlatformTicketStatusDto } from './dto/support.dto';

type PlatformRequest = { platformUser: AuthenticatedPlatformUser };

@Controller('platform/support')
@UseGuards(PlatformJwtGuard, PlatformRolesGuard)
@PlatformRoles(PlatformRole.PLATFORM_ADMIN, PlatformRole.PLATFORM_SUPPORT)
export class PlatformSupportController {
  constructor(private readonly service: PlatformSupportService, private readonly operations: SupportOperations) {}

  @Get('summary')
  summary(@Req() req: PlatformRequest) { return this.service.summary(req.platformUser); }

  @Get('tickets')
  list(@Query() query: ListPlatformTicketsDto, @Req() req: PlatformRequest) { return this.service.list(query, req.platformUser); }

  @Get('tickets/:id')
  detail(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Req() req: PlatformRequest) { return this.service.detail(id, req.platformUser); }

  @Post('tickets/:id/replies')
  reply(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Body() dto: CreatePlatformTicketReplyDto, @Req() req: PlatformRequest) {
    return this.service.reply(id, dto, req.platformUser);
  }

  // Least privilege: Support may manage ticket lifecycle; Billing, Offers, Settings, Customers and platform Audit stay Admin-only elsewhere.
  @Patch('tickets/:id/status')
  status(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Body() dto: UpdatePlatformTicketStatusDto, @Req() req: PlatformRequest) {
    return this.service.updateStatus(id, dto, req.platformUser);
  }

  @Patch('tickets/:id/priority')
  priority(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Body() dto: UpdatePlatformTicketPriorityDto, @Req() req: PlatformRequest) {
    return this.service.updatePriority(id, dto, req.platformUser);
  }
  @Get('agents')
  agents() { return this.operations.agents(); }

  @Get('businesses')
  businesses(@Query() q: SupportBusinessesDto) { return this.operations.businesses(q); }

  @Get('businesses/:id')
  business(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) { return this.operations.businessDetail(id); }

  @Patch('tickets/:id/assignment')
  @PlatformRoles(PlatformRole.PLATFORM_ADMIN)
  assign(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Body() dto: AssignSupportDto, @Req() req: PlatformRequest) { return this.operations.assign(id, dto, req.platformUser); }

  @Post('tickets/:id/claim')
  @PlatformRoles(PlatformRole.PLATFORM_SUPPORT)
  claim(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Body() dto: SupportRevisionDto, @Req() req: PlatformRequest) { return this.operations.assign(id, { ...dto, agentId: req.platformUser.id }, req.platformUser, true); }

  @Post('tickets/:id/escalation')
  escalate(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Body() dto: EscalateSupportDto, @Req() req: PlatformRequest) { return this.operations.escalate(id, dto, req.platformUser); }

  @Patch('tickets/:id/escalation')
  @PlatformRoles(PlatformRole.PLATFORM_ADMIN)
  manageEscalation(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Body() dto: ManageEscalationDto, @Req() req: PlatformRequest) { return this.operations.manageEscalation(id, dto, req.platformUser); }

  @Post('tickets/:id/read')
  read(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Body() dto: ReadSupportDto, @Req() req: PlatformRequest) { return this.operations.markRead(id, dto, req.platformUser); }

}
