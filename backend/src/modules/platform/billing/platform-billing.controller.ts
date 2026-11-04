import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { PlatformRole } from '@prisma/client';
import { PlatformRoles } from '../auth/decorators/platform-roles.decorator';
import { PlatformJwtGuard } from '../auth/guards/platform-jwt.guard';
import { PlatformRolesGuard } from '../auth/guards/platform-roles.guard';
import { ListBillingDto } from './dto/list-billing.dto';
import { PlatformBillingService } from './platform-billing.service';

@Controller('platform/billing')
@UseGuards(PlatformJwtGuard, PlatformRolesGuard)
@PlatformRoles(PlatformRole.PLATFORM_ADMIN)
export class PlatformBillingController {
  constructor(private readonly billing: PlatformBillingService) {}

  @Get('summary')
  summary(@Query() query: ListBillingDto) {
    return this.billing.summary(query);
  }

  @Get('invoices')
  invoices(@Query() query: ListBillingDto) {
    return this.billing.invoices(query);
  }

  @Get('invoices/:id')
  invoice(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.billing.invoice(id);
  }

  // Invoice settlement view, NOT a standalone payment ledger.
  @Get('payments')
  payments(@Query() query: ListBillingDto) {
    return this.billing.payments(query);
  }
}
