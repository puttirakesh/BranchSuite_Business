import { ManualText, ManualName } from '../../../common/validation/manual-text';
import { IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { SHIFT_TIME } from '../../../common/shift';

export class CreateBranchDto {
  @IsUUID('4')
  companyId!: string;

  @ManualName() @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  // Optional for older clients. Backend will generate a stable branch code.
  @ManualText() @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{2,20}$/)
  code?: string;

  @ManualText() @IsOptional()
  @IsString()
  @MaxLength(240)
  location?: string;

  @ManualText() @IsOptional()
  @IsString()
  @MaxLength(150)
  manager?: string;

  @IsOptional()
  @IsUUID('4')
  managerUserId?: string | null;

  // HH:mm in business time. null clears the shift and turns off late marking.
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @Matches(SHIFT_TIME, { message: 'Shift start must use HH:mm' })
  shiftStart?: string | null;

  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @Matches(SHIFT_TIME, { message: 'Shift end must use HH:mm' })
  shiftEnd?: string | null;

  @IsOptional() @IsInt() @Min(0) @Max(180)
  graceMinutes?: number;
}
