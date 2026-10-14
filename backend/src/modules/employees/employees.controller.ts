import {
  Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post,
  Query, Req, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/gaurds/jwt-auth.guard';
import { EmployeesService, EmployeeAuthUser } from './employees.service';
import {
  CreateEmployeeDto, ListEmployeesDto, UpdateEmployeeDto, UpdateEmployeeStatusDto,
} from './dto/employee.dto';

interface AuthenticatedRequest { authUser: EmployeeAuthUser }

@Controller('employees')
@UseGuards(JwtAuthGuard)
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @Post()
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateEmployeeDto) {
    return this.employees.create(req.authUser, dto);
  }

  @Get('me')
  mine(@Req() req: AuthenticatedRequest) {
    return this.employees.mine(req.authUser);
  }

  @Get()
  list(@Req() req: AuthenticatedRequest, @Query() query: ListEmployeesDto) {
    return this.employees.list(req.authUser, query);
  }

  @Get(':id')
  get(@Req() req: AuthenticatedRequest, @Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.employees.get(req.authUser, id);
  }

  @Patch(':id')
  update(@Req() req: AuthenticatedRequest, @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateEmployeeDto) {
    return this.employees.update(req.authUser, id, dto);
  }

  @Patch(':id/status')
  changeStatus(@Req() req: AuthenticatedRequest, @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateEmployeeStatusDto) {
    return this.employees.changeStatus(req.authUser, id, dto);
  }
}
