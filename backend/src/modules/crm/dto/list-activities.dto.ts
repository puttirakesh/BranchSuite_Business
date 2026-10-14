
import { ActivityStatus, ActivityType } from '@prisma/client';

import { Type } from 'class-transformer';

import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ListActivitiesDto {
  // Filter by company
  @IsOptional()
  @IsUUID('4')
  companyId?: string;

  // Filter by branch
  @IsOptional()
  @IsUUID('4')
  branchId?: string;

  // Filter by lead
  @IsOptional()
  @IsUUID('4')
  leadId?: string;

  // Filter by customer
  @IsOptional()
  @IsUUID('4')
  customerId?: string;

  // Filter by activity type
  @IsOptional()
  @IsEnum(ActivityType)
  type?: ActivityType;

  // Filter by activity status
  @IsOptional()
  @IsEnum(ActivityStatus)
  status?: ActivityStatus;

  // Filter by assigned employee
  @IsOptional()
  @IsUUID('4')
  assignedToId?: string;

  // Activities scheduled on or after this date
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  // Activities scheduled on or before this date
  @IsOptional()
  @IsDateString()
  toDate?: string;

  // Search by activity title
  @IsOptional()
  @IsString()
  @MaxLength(150)
  search?: string;

  // Pagination
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}
