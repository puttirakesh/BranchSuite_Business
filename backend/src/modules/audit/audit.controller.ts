import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/gaurds/jwt-auth.guard';
import { BusinessAdminGuard } from '../auth/gaurds/business-admin.guard';
import { AuditActor, AuditService } from './audit.service';

@UseGuards(JwtAuthGuard, BusinessAdminGuard)
@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}
  @Get()
  list(@Req() req: { authUser: AuditActor }, @Query() query: {
    companyId?: string; branchId?: string; module?: string;
    from?: string; to?: string; cursor?: string; limit?: string;
  }) {
    return this.audit.list(req.authUser, query);
  }
}
