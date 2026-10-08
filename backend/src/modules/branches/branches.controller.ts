
import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { BranchesService } from './branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';

import { JwtAuthGuard } from '../auth/gaurds/jwt-auth.guard';
import { BusinessAdminGuard } from '../auth/gaurds/business-admin.guard';

type AuthenticatedRequest = {
  authUser: {
    id: string;
    tenantId: string;
    roles: string[];
  };
};

@UseGuards(JwtAuthGuard, BusinessAdminGuard)
@Controller('branches')
export class BranchesController {
  constructor(
    private readonly branchesService: BranchesService,
  ) {}

  @Post()
  create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateBranchDto,
  ) {
    return this.branchesService.create(
      req.authUser.tenantId,
      req.authUser.id,
      dto,
    );
  }

  @Get()
  findAll(
    @Req() req: AuthenticatedRequest,
    @Query('companyId') companyId?: string,
  ) {
    return this.branchesService.findAll(
      req.authUser.tenantId,
      req.authUser.id,
      companyId,
    );
  }
}
