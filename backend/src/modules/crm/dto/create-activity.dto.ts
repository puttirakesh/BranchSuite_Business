import { ManualText } from '../../../common/validation/manual-text';

import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';

import { ActivityType } from '@prisma/client';

export class CreateActivityDto {
  @IsUUID('4')
  @IsNotEmpty()
  companyId!: string;

  @IsOptional()
  @IsUUID('4')
  branchId?: string;

  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsUUID('4')
  leadId?: string | null;

  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsUUID('4')
  customerId?: string | null;

  @ManualText() @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  title!: string;

  @ManualText() @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsEnum(ActivityType)
  type!: ActivityType;

  @IsDateString()
  scheduledAt!: string;

  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsUUID('4')
  assignedToId?: string | null;
}
