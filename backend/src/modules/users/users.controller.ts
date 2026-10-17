import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Put,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";

import { UsersService } from "./users.service";

import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { AssignRoleDto } from "./dto/assign-role.dto";
import { AssignAccessDto } from "./dto/assign-access.dto";
import { ReplaceCompanyAccessDto } from "./dto/replace-company-access.dto";

import { JwtAuthGuard } from "../auth/gaurds/jwt-auth.guard";
import { BusinessAdminGuard } from "../auth/gaurds/business-admin.guard";

type AuthenticatedRequest = {
  authUser: {
    id: string;
    tenantId: string;
    roles: string[];
  };
};

@UseGuards(JwtAuthGuard, BusinessAdminGuard)
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // =====================================================
  // CREATE STAFF
  // =====================================================

  @Post()
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateUserDto) {
    return this.usersService.create(req.authUser, dto);
  }

  // =====================================================
  // LIST USERS
  // =====================================================

  @Get()
  findAll(@Req() req: AuthenticatedRequest) {
    return this.usersService.findAll(req.authUser.tenantId);
  }

  // =====================================================
  // GET USER DETAILS
  // =====================================================

  @Get(":id")
  findOne(@Req() req: AuthenticatedRequest, @Param("id") id: string) {
    return this.usersService.findOne(req.authUser.tenantId, id);
  }

  // =====================================================
  // UPDATE USER PROFILE
  // =====================================================

  @Patch(":id")
  update(
    @Req() req: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(req.authUser.tenantId, id, dto);
  }

  // =====================================================
  // ACTIVATE USER
  // =====================================================

  @Patch(":id/activate")
  activate(@Req() req: AuthenticatedRequest, @Param("id") id: string) {
    return this.usersService.changeStatus(
      req.authUser.tenantId,
      id,
      "ACTIVE",
      req.authUser.id,
    );
  }

  // =====================================================
  // DEACTIVATE USER
  // =====================================================

  @Patch(":id/deactivate")
  deactivate(@Req() req: AuthenticatedRequest, @Param("id") id: string) {
    return this.usersService.changeStatus(
      req.authUser.tenantId,
      id,
      "INACTIVE",
      req.authUser.id,
    );
  }

  // =====================================================
  // SUSPEND USER
  // =====================================================

  @Patch(":id/suspend")
  suspend(@Req() req: AuthenticatedRequest, @Param("id") id: string) {
    return this.usersService.changeStatus(
      req.authUser.tenantId,
      id,
      "SUSPENDED",
      req.authUser.id,
    );
  }

  // =====================================================
  // ASSIGN EMPLOYEE ROLE
  // =====================================================

  @Post(":id/roles")
  assignRole(
    @Req() req: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() dto: AssignRoleDto,
  ) {
    // AssignRoleDto restricts the role to EMPLOYEE.
    // ValidationPipe validates the request body.

    return this.usersService.assignEmployeeRole(
      req.authUser.tenantId,
      id,
      req.authUser.id,
    );
  }

  // =====================================================
  // ASSIGN COMPANY AND BRANCH ACCESS
  // =====================================================

  @Post(":id/access")
  assignAccess(
    @Req() req: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() dto: AssignAccessDto,
  ) {
    return this.usersService.assignAccess(
      req.authUser.tenantId,
      id,
      dto.companyId,
      dto.branchIds,
    );
  }

  // Replace access within the selected company in one transaction.
  @Put(":id/access")
  replaceAccess(
    @Req() req: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() dto: ReplaceCompanyAccessDto,
  ) {
    return this.usersService.replaceCompanyAccess(
      req.authUser,
      id,
      dto.companyId,
      dto.branchIds,
    );
  }

  // =====================================================
  // REVOKE SELECTED BRANCH ACCESS
  // =====================================================

  @Delete(":id/access")
  revokeAccess(
    @Req() req: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() dto: AssignAccessDto,
  ) {
    return this.usersService.revokeAccess(
      req.authUser.tenantId,
      id,
      req.authUser.id,
      dto.companyId,
      dto.branchIds,
    );
  }
}
