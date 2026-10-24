import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/gaurds/jwt-auth.guard';
import { BusinessAdminGuard } from '../auth/gaurds/business-admin.guard';
import type { AuditActor } from '../audit/audit.service';
import { CreateDepartmentDto, DepartmentEmployeesDto, ListDepartmentsDto } from './department.dto';
import { DepartmentsService } from './departments.service';

@Controller('departments')
@UseGuards(JwtAuthGuard)
export class DepartmentsController {
  constructor(private readonly departments: DepartmentsService) {}
  @Get()
  list(@Req() req: { authUser: AuditActor }, @Query() query: ListDepartmentsDto) {
    return this.departments.list(req.authUser, query);
  }
  @Post()
  @UseGuards(BusinessAdminGuard)
  create(@Req() req: { authUser: AuditActor }, @Body() dto: CreateDepartmentDto) {
    return this.departments.create(req.authUser, dto);
  }
  @Get(':id/employees')
  @UseGuards(BusinessAdminGuard)
  employees(@Req() req: { authUser: AuditActor }, @Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Query() query: DepartmentEmployeesDto) {
    return this.departments.employees(req.authUser, id, query);
  }
}
