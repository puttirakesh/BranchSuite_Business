import { ManualText, ManualName } from '../../../common/validation/manual-text';
import { Type } from 'class-transformer';
import {
  IsEmail, IsEnum, IsInt, IsOptional, IsString, IsUUID,
  Matches, Max, MaxLength, Min, IsBoolean, MinLength,
} from 'class-validator';
import { EmploymentStatus, EmploymentType } from '@prisma/client';

export class CreateEmployeeDto {
  @IsOptional() @IsUUID('4') reportingManagerId?: string | null;
  @IsUUID('4') companyId!: string;
  @IsUUID('4') branchId!: string;
  @IsUUID('4') userId!: string; // Existing authenticated User; no duplicate account
  @ManualText() @IsOptional() @IsString() @Matches(/^[A-Za-z0-9_-]{2,30}$/) employeeCode?: string;
  @ManualText() @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) joiningDate!: string;
  @ManualText() @IsOptional() @IsString() @MaxLength(100) department?: string;
  @ManualText() @IsOptional() @IsString() @MaxLength(100) designation?: string;
  @IsOptional() @IsEnum(EmploymentType) employmentType?: EmploymentType;
  @ManualText() @IsOptional() @IsEmail() @MaxLength(254) workEmail?: string;
  @ManualText() @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

export class UpdateEmployeeDto {
  @IsOptional() @IsUUID('4') reportingManagerId?: string | null;
  @ManualText() @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) transferDate?: string;
  @ManualName() @IsOptional() @IsString() @MaxLength(100) bankName?: string;
  @ManualText() @IsOptional() @Matches(/^(\d{4})?$/) bankEnding?: string;
  @ManualText() @IsOptional() @Matches(/^([A-Z]{4}0[A-Z0-9]{6})?$/) bankIfsc?: string;
  @ManualText() @IsOptional() @Matches(/^([A-Z]{5}\d{4}[A-Z])?$/) pan?: string;
  @ManualText() @IsOptional() @Matches(/^(\d{12})?$/) uan?: string;
  @IsOptional() @IsUUID('4') branchId?: string;
  @ManualText() @IsOptional() @IsString() @MaxLength(100) department?: string;
  @ManualText() @IsOptional() @IsString() @MaxLength(100) designation?: string;
  @IsOptional() @IsEnum(EmploymentType) employmentType?: EmploymentType;
  @ManualText() @IsOptional() @IsEmail() @MaxLength(254) workEmail?: string;
  @ManualText() @IsOptional() @IsString() @MaxLength(1000) notes?: string;
  @ManualText() @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) joiningDate?: string;
}

export class OnboardEmployeeDto extends UpdateEmployeeDto {
  @IsUUID('4') companyId!: string;
  @IsUUID('4') declare branchId: string;
  @ManualName() @IsString() @MinLength(1) @MaxLength(150) name!: string;
  @ManualText() @IsEmail() @MaxLength(254) email!: string;
  @ManualText() @IsOptional() @Matches(/^\d{10}$/) phone?: string;
  @Matches(/\S/, { message: 'Password must contain a non-space character' })
  @IsOptional() @IsString() @MinLength(8) @MaxLength(128) password?: string;
  @IsOptional() @IsBoolean() loginEnabled?: boolean;
  @IsOptional() @IsEnum(EmploymentStatus) status?: EmploymentStatus;
  @ManualText() @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) declare joiningDate: string;
  @ManualText() @IsString() @Matches(/^(?!0+(?:\.0+)?$)\d{1,12}(\.\d{1,2})?$/, { message: 'Monthly gross salary must be greater than zero' }) gross!: string;
  @ManualText() @IsOptional() @Matches(/^\d{1,12}(\.\d{1,2})?$/) deductions?: string;
}

export class UpdateEmployeeStatusDto {
  @IsEnum(EmploymentStatus) status!: EmploymentStatus;
  @ManualText() @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) exitDate?: string;
}

export class ListEmployeesDto {
  @IsOptional() @IsUUID('4') companyId?: string;
  @IsOptional() @IsUUID('4') branchId?: string;
  @IsOptional() @IsEnum(EmploymentStatus) status?: EmploymentStatus;
  @ManualText() @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}
