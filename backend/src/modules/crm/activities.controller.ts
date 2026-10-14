
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

import { JwtAuthGuard } from '../auth/gaurds/jwt-auth.guard';
import { PermissionsGuard } from '../auth/gaurds/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';

import {
  ActivitiesAuthUser,
  ActivitiesService,
} from './activities.service';

import { CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';
import { ListActivitiesDto } from './dto/list-activities.dto';

interface ActivitiesRequest {
  authUser: ActivitiesAuthUser;
}

@Controller('activities')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ActivitiesController {
  constructor(
    private readonly activitiesService: ActivitiesService,
  ) {}

  // =====================================================
  // CREATE ACTIVITY
  // =====================================================

  @Post()
  @RequirePermissions('crm.manage')
  create(
    @Req() request: ActivitiesRequest,
    @Body() dto: CreateActivityDto,
  ) {
    return this.activitiesService.create(request.authUser, dto);
  }

  // =====================================================
  // LIST ACTIVITIES
  // =====================================================

  @Get()
  @RequirePermissions('crm.read')
  findAll(
    @Req() request: ActivitiesRequest,
    @Query() query: ListActivitiesDto,
  ) {
    return this.activitiesService.findAll(request.authUser, query);
  }

  // =====================================================
  // GET ACTIVITY DETAILS
  // =====================================================

  @Get(':id')
  @RequirePermissions('crm.read')
  findOne(
    @Req() request: ActivitiesRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: string,
  ) {
    return this.activitiesService.findOne(request.authUser, id);
  }

  // =====================================================
  // UPDATE ACTIVITY
  // =====================================================

  @Patch(':id')
  @RequirePermissions('crm.manage')
  update(
    @Req() request: ActivitiesRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: string,
    @Body() dto: UpdateActivityDto,
  ) {
    return this.activitiesService.update(
      request.authUser,
      id,
      dto,
    );
  }

  // =====================================================
  // COMPLETE ACTIVITY
  // =====================================================

  @Patch(':id/complete')
  @RequirePermissions('crm.manage')
  complete(
    @Req() request: ActivitiesRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: string,
  ) {
    return this.activitiesService.complete(
      request.authUser,
      id,
    );
  }

  // =====================================================
  // CANCEL ACTIVITY
  // =====================================================

  @Patch(':id/cancel')
  @RequirePermissions('crm.manage')
  cancel(
    @Req() request: ActivitiesRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: string,
  ) {
    return this.activitiesService.cancel(
      request.authUser,
      id,
    );
  }
}
