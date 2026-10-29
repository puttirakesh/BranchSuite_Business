import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/gaurds/jwt-auth.guard';
import { AuditActor, AuditService } from './audit.service';

// Role access is enforced in AuditService.list: business owners/admins plus company, branch, HR
// and payroll managers, each limited to the branches and companies they are assigned to.
@UseGuards(JwtAuthGuard)
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
