
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/gaurds/jwt-auth.guard';

import {
  PayrollAuthUser,
  PayrollService,
} from './payroll.service';

import {
  PayrollPolicyAuthUser,
  PayrollPolicyService,
} from './payroll-policy.service';

import {
  AssignEmployeeSalaryDto,
  CreatePayrollPeriodDto,
  CreateSalaryStructureDto,
  RecordPayrollPaymentDto,
  ReviseEmployeeSalaryDto,
  ListPayrollIncentivesDto,
  SavePayrollIncentiveDto,
} from './dto/payroll.dto';

import {
  CreatePayrollPolicyDto,
  ListPayrollPoliciesDto,
  ResolvePayrollPolicyDto,
} from './dto/payroll-policy.dto';

interface AuthRequest {
  authUser: PayrollAuthUser & PayrollPolicyAuthUser;
}

@Controller('payroll')
@UseGuards(JwtAuthGuard)
export class PayrollController {
  constructor(
    private readonly payroll: PayrollService,
    private readonly payrollPolicy: PayrollPolicyService,
  ) {}

  @Get('incentives')
  incentives(@Req() req: AuthRequest, @Query() query: ListPayrollIncentivesDto) {
    return this.payroll.listIncentives(req.authUser, query.companyId, query.branchId, query.year, query.month);
  }

  @Post('incentives')
  saveIncentive(@Req() req: AuthRequest, @Body() dto: SavePayrollIncentiveDto) {
    return this.payroll.saveIncentive(req.authUser, dto);
  }

  // COMPANY PAYROLL POLICIES

  @Post('policies')
  createPolicy(
    @Req() req: AuthRequest,
    @Body() dto: CreatePayrollPolicyDto,
  ) {
    return this.payrollPolicy.create(req.authUser, dto);
  }

  @Get('policies')
  listPolicies(
    @Req() req: AuthRequest,
    @Query() query: ListPayrollPoliciesDto,
  ) {
    return this.payrollPolicy.list(
      req.authUser,
      query.companyId,
    );
  }

  @Get('policies/resolve')
  resolvePolicy(
    @Req() req: AuthRequest,
    @Query() query: ResolvePayrollPolicyDto,
  ) {
    return this.payrollPolicy.resolve(
      req.authUser,
      query,
    );
  }

  // SALARY STRUCTURES

  @Post('salary-structures')
  createStructure(
    @Req() req: AuthRequest,
    @Body() dto: CreateSalaryStructureDto,
  ) {
    return this.payroll.createStructure(
      req.authUser,
      dto,
    );
  }

  @Get('salary-structures')
  structures(
    @Req() req: AuthRequest,
    @Query(
      'companyId',
      new ParseUUIDPipe({ version: '4' }),
    )
    companyId: string,
  ) {
    return this.payroll.listStructures(
      req.authUser,
      companyId,
    );
  }

  // EMPLOYEE SALARY ASSIGNMENTS

  @Post('employee-salaries')
  assignSalary(
    @Req() req: AuthRequest,
    @Body() dto: AssignEmployeeSalaryDto,
  ) {
    return this.payroll.assignSalary(
      req.authUser,
      dto,
    );
  }

  // CREATE EFFECTIVE-DATED SALARY REVISION

  @Post('employee-salaries/revise')
  reviseSalary(
    @Req() req: AuthRequest,
    @Body() dto: ReviseEmployeeSalaryDto,
  ) {
    return this.payroll.reviseEmployeeSalary(
      req.authUser,
      dto,
    );
  }

  @Get('employee-salaries')
  employeeSalaries(
    @Req() req: AuthRequest,
    @Query(
      'companyId',
      new ParseUUIDPipe({ version: '4' }),
    )
    companyId: string,
    @Query(
      'branchId',
      new ParseUUIDPipe({ version: '4' }),
    )
    branchId: string,
  ) {
    return this.payroll.listAssignments(
      req.authUser,
      companyId,
      branchId,
    );
  }

  // PAYROLL PERIODS

  @Post('periods')
  createPeriod(
    @Req() req: AuthRequest,
    @Body() dto: CreatePayrollPeriodDto,
  ) {
    return this.payroll.createPeriod(
      req.authUser,
      dto,
    );
  }

  @Get('periods')
  periods(
    @Req() req: AuthRequest,
    @Query(
      'companyId',
      new ParseUUIDPipe({ version: '4' }),
    )
    companyId: string,
    @Query(
      'branchId',
      new ParseUUIDPipe({ version: '4' }),
    )
    branchId: string,
  ) {
    return this.payroll.listPeriods(
      req.authUser,
      companyId,
      branchId,
    );
  }

  // CALCULATE PAYROLL

  @Post('periods/:id/calculate')
  calculate(
    @Req() req: AuthRequest,
    @Param(
      'id',
      new ParseUUIDPipe({ version: '4' }),
    )
    id: string,
  ) {
    return this.payroll.calculate(
      req.authUser,
      id,
    );
  }

  // APPROVE PAYROLL

  @Post('runs/:id/approve')
  approve(
    @Req() req: AuthRequest,
    @Param(
      'id',
      new ParseUUIDPipe({ version: '4' }),
    )
    id: string,
  ) {
    return this.payroll.approve(
      req.authUser,
      id,
    );
  }

  // PUBLISH PAYSLIPS

  @Post('runs/:id/publish')
  publish(
    @Req() req: AuthRequest,
    @Param(
      'id',
      new ParseUUIDPipe({ version: '4' }),
    )
    id: string,
  ) {
    return this.payroll.publish(
      req.authUser,
      id,
    );
  }

  // PAYROLL RUN DETAILS

  @Get('runs/:id')
  run(
    @Req() req: AuthRequest,
    @Param(
      'id',
      new ParseUUIDPipe({ version: '4' }),
    )
    id: string,
  ) {
    return this.payroll.getRun(
      req.authUser,
      id,
    );
  }

  // RECORD PAYMENTS

  @Post('entries/:id/pay')
  pay(
    @Req() req: AuthRequest,
    @Param(
      'id',
      new ParseUUIDPipe({ version: '4' }),
    )
    id: string,
    @Body() dto: RecordPayrollPaymentDto,
  ) {
    return this.payroll.recordPayment(
      req.authUser,
      id,
      dto,
    );
  }

  // EMPLOYEE PAYSLIPS

  @Get('my-payslips')
  myPayslips(@Req() req: AuthRequest) {
    return this.payroll.myPayslips(
      req.authUser,
    );
  }
}
