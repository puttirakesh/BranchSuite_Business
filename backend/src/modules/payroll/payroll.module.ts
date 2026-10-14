
import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';

import { PayrollController } from './payroll.controller';
import { PayrollService } from './payroll.service';
import { PayrollPolicyService } from './payroll-policy.service';

@Module({
  imports: [AuthModule],
  controllers: [PayrollController],
  providers: [
    PayrollService,
    PayrollPolicyService,
  ],
  exports: [
    PayrollService,
    PayrollPolicyService,
  ],
})
export class PayrollModule {}
