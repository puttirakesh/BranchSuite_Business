import { ManualText, ManualName } from '../../../common/validation/manual-text';

import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import {
  PayrollPaymentMethod,
  SalaryComponentKind,
} from '@prisma/client';

export class ReturnPayrollDto {
  @ManualText() @IsString() @IsNotEmpty() @MaxLength(1000)
  reason!: string;
}

const MONEY_PATTERN = /^\d{1,12}(\.\d{1,2})?$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class FixedComponentDto {
  @ManualText() @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  code!: string;

  @ManualName() @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsEnum(SalaryComponentKind)
  kind!: SalaryComponentKind;

  @ManualText() @IsString()
  @Matches(MONEY_PATTERN)
  amount!: string;
}

export class CreateSalaryStructureDto {
  @IsUUID('4')
  companyId!: string;

  @ManualName() @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ManualText() @IsOptional()
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @ManualText() @IsString()
  @Matches(MONEY_PATTERN)
  basicAmount!: string;

  @IsArray()
  @ArrayMinSize(0)
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => FixedComponentDto)
  components!: FixedComponentDto[];
}

export class AssignEmployeeSalaryDto {
  @IsUUID('4')
  companyId!: string;

  @IsUUID('4')
  branchId!: string;

  @IsUUID('4')
  userId!: string;

  @IsUUID('4')
  structureId!: string;

  @ManualText() @Matches(DATE_PATTERN)
  effectiveFrom!: string;

  @ManualText() @IsOptional()
  @Matches(DATE_PATTERN)
  effectiveTo?: string;

  @ManualText() @IsOptional()
  @IsString()
  @Matches(MONEY_PATTERN)
  basicOverride?: string;
}

export class ReviseEmployeeSalaryDto {
  @IsUUID('4')
  companyId!: string;

  @IsUUID('4')
  branchId!: string;

  @IsUUID('4')
  userId!: string;

  @ManualText() @Matches(/^\d{4}-\d{2}-01$/)
  effectiveFrom!: string;

  @ManualText() @IsString()
  @Matches(MONEY_PATTERN)
  gross!: string;

  @ManualText() @IsString()
  @Matches(MONEY_PATTERN)
  deductions!: string;

  @ManualText() @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

export class CreatePayrollPeriodDto {
  @IsUUID('4')
  companyId!: string;

  @IsUUID('4')
  branchId!: string;

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

export class RecordPayrollPaymentDto {
  @IsEnum(PayrollPaymentMethod)
  method!: PayrollPaymentMethod;

  @ManualText() @IsOptional()
  @IsString()
  @MaxLength(150)
  reference?: string;

  // PROCESSING records a sent transfer that still needs a bank result.
  @IsOptional() @IsIn(['PROCESSING', 'CONFIRMED'])
  status?: 'PROCESSING' | 'CONFIRMED';
}

export class FailPayrollPaymentDto {
  @ManualText() @IsString() @IsNotEmpty() @MaxLength(300)
  reason!: string;
}

export class CreateDealIncentiveDto {
  @IsUUID('4') dealId!: string;
  @ManualText() @IsString() @Matches(MONEY_PATTERN) amount!: string;
  @Type(() => Number) @IsInt() @Min(2000) @Max(2100) year!: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(12) month!: number;
  @ManualText() @IsOptional() @IsString() @MaxLength(300) description?: string;
}

export class ReviewDealIncentiveDto {
  @ManualText() @IsOptional() @IsString() @MaxLength(300) note?: string;
}

export class ListDealIncentivesDto {
  @IsUUID('4') companyId!: string;
  @IsOptional() @IsUUID('4') branchId?: string;
  @IsOptional() @IsUUID('4') dealId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(2000) @Max(2100) year?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(12) month?: number;
}

export class SavePayrollIncentiveDto {
  @IsUUID('4') companyId!: string;
  @IsUUID('4') branchId!: string;
  @IsUUID('4') userId!: string;
  @Type(() => Number) @IsInt() @Min(2000) @Max(2100) year!: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(12) month!: number;
  @ManualText() @IsString() @Matches(MONEY_PATTERN) amount!: string;
  @ManualText() @IsString() @IsNotEmpty() @MaxLength(300) description!: string;
}

export class ListPayrollIncentivesDto {
  @IsUUID('4') companyId!: string;
  @IsUUID('4') branchId!: string;
  @Type(() => Number) @IsInt() @Min(2000) @Max(2100) year!: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(12) month!: number;
}
