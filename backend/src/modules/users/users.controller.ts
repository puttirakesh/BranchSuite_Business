
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

import { AssignRoleDto } from './dto/assign-role.dto';
import { AssignAccessDto } from './dto/assign-access.dto';

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
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
  ) {}

  @Post()
  create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateUserDto,
  ) {
    return this.usersService.create(
      req.authUser.tenantId,
      dto,
    );
  }

  @Get()
  findAll(@Req() req: AuthenticatedRequest) {
    return this.usersService.findAll(
      req.authUser.tenantId,
    );
  }

  @Get(':id')
  findOne(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.usersService.findOne(
      req.authUser.tenantId,
      id,
    );
  }

  @Patch(':id')
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(
      req.authUser.tenantId,
      id,
      dto,
    );
  }

  @Patch(':id/activate')
  activate(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.usersService.changeStatus(
      req.authUser.tenantId,
      id,
      'ACTIVE',
      req.authUser.id,
    );
  }

  @Patch(':id/deactivate')
  deactivate(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.usersService.changeStatus(
      req.authUser.tenantId,
      id,
      'INACTIVE',
      req.authUser.id,
    );
  }

  @Patch(':id/suspend')
  suspend(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.usersService.changeStatus(
      req.authUser.tenantId,
      id,
      'SUSPENDED',
      req.authUser.id,
    );
  }

  
  @Post(':id/roles')
  assignRole(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: AssignRoleDto,
  ) {
    return this.usersService.assignEmployeeRole(
      req.authUser.tenantId,
      id,
      req.authUser.id,
    );
  }

  @Post(':id/access')
  assignAccess(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: AssignAccessDto,
  ) {
    return this.usersService.assignAccess(
      req.authUser.tenantId,
      id,
      dto.companyId,
      dto.branchIds,
    );
  }

}
