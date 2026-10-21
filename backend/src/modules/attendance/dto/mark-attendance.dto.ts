import { ManualText } from '../../../common/validation/manual-text';
import { AttendanceStatus } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

export class MarkAttendanceDto {
  @IsUUID('4')
  @IsNotEmpty()
  companyId!: string;

  @IsUUID('4')
  @IsNotEmpty()
  branchId!: string;

  @IsUUID('4')
  @IsNotEmpty()
  userId!: string;

  @ManualText() @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'attendanceDate must be YYYY-MM-DD' })
  attendanceDate!: string;

  @IsEnum(AttendanceStatus)
  status!: AttendanceStatus;

  @ManualText() @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
