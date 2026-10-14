
import { Module } from "@nestjs/common";

import { HealthController } from "./health.controller";

import { PrismaModule } from "./prisma/prisma.module";

import { UsersModule } from "./modules/users/users.module";
import { AuthModule } from "./modules/auth/auth.module";

import { CompaniesModule } from "./modules/companies/companies.module";
import { BranchesModule } from "./modules/branches/branches.module";

import { DashboardModule } from "./modules/dashboard/dashboard.module";

import { CrmModule } from "./modules/crm/crm.module";

import { AttendanceModule } from "./modules/attendance/attendance.module";
import { LeaveModule } from "./modules/leave/leave.module";

import { EmployeesModule } from "./modules/employees/employees.module";

import { PayrollModule } from "./modules/payroll/payroll.module";

import { TasksModule } from "./modules/tasks/tasks.module";

// Salary Advances
import { AdvancesModule } from "./modules/advances/advances.module";

@Module({
  imports: [
    PrismaModule,

    UsersModule,
    AuthModule,

    CompaniesModule,
    BranchesModule,

    DashboardModule,
    CrmModule,

    AttendanceModule,
    LeaveModule,

    EmployeesModule,

    PayrollModule,

    TasksModule,

    AdvancesModule,
  ],

  controllers: [HealthController],

  providers: [],
})
export class AppModule {}
