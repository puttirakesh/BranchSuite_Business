import { ManualText } from '../../../common/validation/manual-text';

import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AttendanceCorrectionStatus } from '@prisma/client';

export class CreateAttendanceCorrectionDto {
  @IsUUID('4')
  attendanceId!: string;

  @IsDateString()
  requestedCheckInAt!: string;

  @IsDateString()
  requestedCheckOutAt!: string;

  @ManualText() @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason!: string;
}

export class ReviewAttendanceCorrectionDto {
  @ManualText() @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class ListAttendanceCorrectionsDto {
  @IsUUID('4')
  companyId!: string;

  @IsOptional()
  @IsUUID('4')
  branchId?: string;

  @IsOptional()
  @IsEnum(AttendanceCorrectionStatus)
  status?: AttendanceCorrectionStatus;

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
