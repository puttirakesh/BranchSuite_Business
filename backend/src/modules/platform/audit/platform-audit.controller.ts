import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { PlatformRole } from '@prisma/client';
import { PlatformJwtGuard } from '../auth/guards/platform-jwt.guard';
import { PlatformRolesGuard } from '../auth/guards/platform-roles.guard';
import { PlatformRoles } from '../auth/decorators/platform-roles.decorator';
import { ListPlatformAuditDto } from './dto/list-platform-audit.dto';
import { PlatformAuditService } from './platform-audit.service';

@Controller('platform/audit')
@UseGuards(PlatformJwtGuard, PlatformRolesGuard)
@PlatformRoles(PlatformRole.PLATFORM_ADMIN)
export class PlatformAuditController {
  constructor(private readonly service: PlatformAuditService) {}

  @Get('summary') summary(@Query() q: ListPlatformAuditDto) { return this.service.summary(q); }
  @Get('modules') modules() { return this.service.modules(); }
  @Get('events') list(@Query() q: ListPlatformAuditDto) { return this.service.list(q); }
  @Get('events/:id') one(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) { return this.service.getOne(id); }
}
