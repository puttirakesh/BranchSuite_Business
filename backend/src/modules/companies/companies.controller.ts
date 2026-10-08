
import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
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
@Controller('companies')
export class CompaniesController {
  constructor(
    private readonly companiesService: CompaniesService,
  ) {}

  @Post()
  create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateCompanyDto,
  ) {
    return this.companiesService.create(
      req.authUser.tenantId,
      req.authUser.id,
      dto,
    );
  }

  @Get()
  findAll(@Req() req: AuthenticatedRequest) {
    return this.companiesService.findAll(
      req.authUser.tenantId,
    );
  }
}
