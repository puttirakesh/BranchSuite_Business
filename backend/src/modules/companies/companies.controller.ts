
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import {
  CompaniesService,
  type CompanyActor,
} from './companies.service';

import { CreateCompanyDto } from './dto/create-company.dto';

import { JwtAuthGuard } from '../auth/gaurds/jwt-auth.guard';
import { BusinessAdminGuard } from '../auth/gaurds/business-admin.guard';

type AuthenticatedRequest = {
  authUser: CompanyActor;
};

type UpdateCompanyDto = {
  name?: string;
};

type UpdateCompanyStatusDto = {
  status: 'ACTIVE' | 'INACTIVE';
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
      req.authUser,
      dto,
    );
  }

  @Get()
  findAll(@Req() req: AuthenticatedRequest) {
    return this.companiesService.findAll(
      req.authUser,
    );
  }

  @Get(':id')
  findOne(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    companyId: string,
  ) {
    return this.companiesService.findOne(
      req.authUser,
      companyId,
    );
  }

  @Patch(':id')
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    companyId: string,
    @Body() dto: UpdateCompanyDto,
  ) {
    if (
      !dto ||
      typeof dto.name !== 'string' ||
      !dto.name.trim()
    ) {
      throw new BadRequestException(
        'Company name is required',
      );
    }

    return this.companiesService.update(
      req.authUser,
      companyId,
      {
        name: dto.name,
      },
    );
  }

  @Patch(':id/employee-numbering')
  updateEmployeeNumbering(@Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) companyId: string,
    @Body() dto: { prefix?: unknown; digits?: unknown; nextNumber?: unknown }) {
    return this.companiesService.updateEmployeeNumbering(req.authUser, companyId, dto);
  }

  @Patch(':id/status')
  updateStatus(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    companyId: string,
    @Body() dto: UpdateCompanyStatusDto,
  ) {
    if (
      !dto ||
      (dto.status !== 'ACTIVE' &&
        dto.status !== 'INACTIVE')
    ) {
      throw new BadRequestException(
        'Status must be ACTIVE or INACTIVE',
      );
    }

    return this.companiesService.updateStatus(
      req.authUser,
      companyId,
      dto.status,
    );
  }
}
