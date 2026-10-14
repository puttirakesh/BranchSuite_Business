
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';

import { ActivityType } from '@prisma/client';

export class UpdateActivityDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  title?: string;

  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(ActivityType)
  type?: ActivityType;

  @ValidateIf((_object, value) => value !== undefined)
  @IsDateString()
  scheduledAt?: string;

  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsUUID('4')
  assignedToId?: string | null;
}
