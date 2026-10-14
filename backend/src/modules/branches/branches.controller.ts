
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import {
  BranchesService,
  type BranchActor,
} from './branches.service';

import { CreateBranchDto } from './dto/create-branch.dto';

import { JwtAuthGuard } from '../auth/gaurds/jwt-auth.guard';
import { BusinessAdminGuard } from '../auth/gaurds/business-admin.guard';

type AuthenticatedRequest = {
  authUser: BranchActor;
};

type UpdateBranchDto = {
  name?: string;
};

type UpdateBranchStatusDto = {
  status: 'ACTIVE' | 'INACTIVE';
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
      req.authUser,
      dto,
    );
  }

  @Get()
  findAll(
    @Req() req: AuthenticatedRequest,
    @Query('companyId') companyId?: string,
  ) {
    return this.branchesService.findAll(
      req.authUser,
      companyId,
    );
  }

  @Get(':id')
  findOne(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    branchId: string,
  ) {
    return this.branchesService.findOne(
      req.authUser,
      branchId,
    );
  }

  @Patch(':id')
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    branchId: string,
    @Body() dto: UpdateBranchDto,
  ) {
    if (
      !dto ||
      typeof dto.name !== 'string' ||
      !dto.name.trim()
    ) {
      throw new BadRequestException(
        'Branch name is required',
      );
    }

    return this.branchesService.update(
      req.authUser,
      branchId,
      {
        name: dto.name,
      },
    );
  }

  @Patch(':id/status')
  updateStatus(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    branchId: string,
    @Body() dto: UpdateBranchStatusDto,
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

    return this.branchesService.updateStatus(
      req.authUser,
      branchId,
      dto.status,
    );
  }
}
