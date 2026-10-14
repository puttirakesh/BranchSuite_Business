
import {
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
import { LeadStage } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsUUID,
  ValidateIf,
} from 'class-validator';

import { JwtAuthGuard } from '../auth/gaurds/jwt-auth.guard';
import { PermissionsGuard } from '../auth/gaurds/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';

import {
  LeadsAuthUser,
  LeadsService,
} from './leads.service';

import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { ListLeadsDto } from './dto/list-leads.dto';

class ChangeLeadStageDto {
  @IsEnum(LeadStage)
  stage!: LeadStage;
}

class AssignLeadDto {
  @ValidateIf((_object, value) => value !== null)
  @IsUUID('4')
  @IsNotEmpty()
  assignedToId!: string | null;
}

interface LeadsRequest {
  authUser: LeadsAuthUser;
}

@Controller('leads')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class LeadsController {
  constructor(
    private readonly leadsService: LeadsService,
  ) {}

  // Create a lead
  @Post()
  @RequirePermissions('crm.manage')
  create(
    @Req() request: LeadsRequest,
    @Body() dto: CreateLeadDto,
  ) {
    return this.leadsService.create(
      request.authUser,
      dto,
    );
  }

  // List leads with filters and pagination
  @Get()
  @RequirePermissions('crm.read')
  findAll(
    @Req() request: LeadsRequest,
    @Query() query: ListLeadsDto,
  ) {
    return this.leadsService.findAll(
      request.authUser,
      query,
    );
  }

  // Get one lead
  @Get(':id')
  @RequirePermissions('crm.read')
  findOne(
    @Req() request: LeadsRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: string,
  ) {
    return this.leadsService.findOne(
      request.authUser,
      id,
    );
  }

  // Update lead details
  @Patch(':id')
  @RequirePermissions('crm.manage')
  update(
    @Req() request: LeadsRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: string,
    @Body() dto: UpdateLeadDto,
  ) {
    return this.leadsService.update(
      request.authUser,
      id,
      dto,
    );
  }

  // Change lead stage
  @Patch(':id/stage')
  @RequirePermissions('crm.manage')
  changeStage(
    @Req() request: LeadsRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: string,
    @Body() dto: ChangeLeadStageDto,
  ) {
    return this.leadsService.changeStage(
      request.authUser,
      id,
      dto.stage,
    );
  }

  // Assign or unassign a lead
  @Patch(':id/assign')
  @RequirePermissions('crm.manage')
  assign(
    @Req() request: LeadsRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: string,
    @Body() dto: AssignLeadDto,
  ) {
    return this.leadsService.assign(
      request.authUser,
      id,
      dto.assignedToId,
    );
  }

  // Convert a qualified lead into a customer
  @Post(':id/convert')
  @RequirePermissions('crm.manage')
  convertToCustomer(
    @Req() request: LeadsRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: string,
  ) {
    return this.leadsService.convertToCustomer(
      request.authUser,
      id,
    );
  }
}
