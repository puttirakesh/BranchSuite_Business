
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';
import {
  MissingAttendanceAction,
  PayrollCalculationMode,
  PayrollDayBasis,
} from '@prisma/client';

export class CreatePayrollPolicyDto {
  @IsUUID('4')
  companyId!: string;

  @IsEnum(PayrollCalculationMode)
  mode!: PayrollCalculationMode;

  @IsOptional()
  @IsEnum(PayrollDayBasis)
  dayBasis?: PayrollDayBasis;

  @IsOptional()
  @IsEnum(MissingAttendanceAction)
  missingAttendanceAction?: MissingAttendanceAction;

  // Always send a decimal string, e.g. "0.50".
  @IsOptional()
  @IsString()
  @Matches(/^(0(\.\d{1,2})?|1(\.0{1,2})?)$/)
  halfDayDeduction?: string;

  @IsOptional()
  @IsBoolean()
  deductUnpaidLeave?: boolean;

  @IsOptional()
  @IsBoolean()
  deductAbsentDays?: boolean;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  effectiveFrom!: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  effectiveTo?: string;
}

export class ListPayrollPoliciesDto {
  @IsUUID('4')
  companyId!: string;
}

export class ResolvePayrollPolicyDto {
  @IsUUID('4')
  companyId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;
}
