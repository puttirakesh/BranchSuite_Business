
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
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

const MONEY_PATTERN = /^\d{1,12}(\.\d{1,2})?$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class FixedComponentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  code!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsEnum(SalaryComponentKind)
  kind!: SalaryComponentKind;

  @IsString()
  @Matches(MONEY_PATTERN)
  amount!: string;
}

export class CreateSalaryStructureDto {
  @IsUUID('4')
  companyId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @IsString()
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

  @Matches(DATE_PATTERN)
  effectiveFrom!: string;

  @IsOptional()
  @Matches(DATE_PATTERN)
  effectiveTo?: string;

  @IsOptional()
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

  @Matches(/^\d{4}-\d{2}-01$/)
  effectiveFrom!: string;

  @IsString()
  @Matches(MONEY_PATTERN)
  gross!: string;

  @IsString()
  @Matches(MONEY_PATTERN)
  deductions!: string;

  @IsString()
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

  @IsOptional()
  @IsString()
  @MaxLength(150)
  reference?: string;
}
