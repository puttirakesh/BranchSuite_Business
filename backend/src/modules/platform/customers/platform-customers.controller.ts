import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query, Req, UseGuards, ValidationPipe } from '@nestjs/common';
import { PlatformRole } from '@prisma/client';
import { PlatformJwtGuard, AuthenticatedPlatformUser } from '../auth/guards/platform-jwt.guard';
import { PlatformRolesGuard } from '../auth/guards/platform-roles.guard';
import { PlatformRoles } from '../auth/decorators/platform-roles.decorator';
import { ListPlatformCustomersDto } from './dto/list-platform-customers.dto';
import { UpdatePlatformCustomerStatusDto } from './dto/update-platform-customer-status.dto';
import { PlatformCustomersService } from './platform-customers.service';

@Controller('platform/customers')
@UseGuards(PlatformJwtGuard, PlatformRolesGuard)
@PlatformRoles(PlatformRole.PLATFORM_ADMIN)
export class PlatformCustomersController {
  constructor(private readonly customers: PlatformCustomersService) {}

  @Get()
  list(@Query(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })) query: ListPlatformCustomersDto) {
    return this.customers.list(query);
  }

  @Get(':id')
  get(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.customers.getById(id);
  }

  @Patch(':id/status')
  changeStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })) dto: UpdatePlatformCustomerStatusDto,
    @Req() request: { platformUser: AuthenticatedPlatformUser },
  ) {
    return this.customers.changeStatus(id, dto, request.platformUser.id);
  }
}
