import { Type } from 'class-transformer';
import {
  IsEmail, IsEnum, IsInt, IsOptional, IsString, IsUUID,
  Matches, Max, MaxLength, Min,
} from 'class-validator';
import { EmploymentStatus, EmploymentType } from '@prisma/client';

export class CreateEmployeeDto {
  @IsUUID('4') companyId!: string;
  @IsUUID('4') branchId!: string;
  @IsUUID('4') userId!: string; // Existing authenticated User; no duplicate account
  @IsString() @Matches(/^[A-Za-z0-9_-]{2,30}$/) employeeCode!: string;
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) joiningDate!: string;
  @IsOptional() @IsString() @MaxLength(100) department?: string;
  @IsOptional() @IsString() @MaxLength(100) designation?: string;
  @IsOptional() @IsEnum(EmploymentType) employmentType?: EmploymentType;
  @IsOptional() @IsEmail() @MaxLength(254) workEmail?: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

export class UpdateEmployeeDto {
  @IsOptional() @IsUUID('4') branchId?: string;
  @IsOptional() @IsString() @MaxLength(100) department?: string;
  @IsOptional() @IsString() @MaxLength(100) designation?: string;
  @IsOptional() @IsEnum(EmploymentType) employmentType?: EmploymentType;
  @IsOptional() @IsEmail() @MaxLength(254) workEmail?: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) joiningDate?: string;
}

export class UpdateEmployeeStatusDto {
  @IsEnum(EmploymentStatus) status!: EmploymentStatus;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) exitDate?: string;
}

export class ListEmployeesDto {
  @IsOptional() @IsUUID('4') companyId?: string;
  @IsOptional() @IsUUID('4') branchId?: string;
  @IsOptional() @IsEnum(EmploymentStatus) status?: EmploymentStatus;
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}
