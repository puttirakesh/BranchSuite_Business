import { ManualText } from '../../../common/validation/manual-text';
import { IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateLeaveRequestDto {
  @IsUUID('4') companyId!: string;
  @IsUUID('4') branchId!: string;
  @IsUUID('4') leaveTypeId!: string;
  @IsOptional() @IsUUID('4') reportingToId?: string;
  @IsDateString() startDate!: string;
  @IsDateString() endDate!: string;
  @ManualText() @IsString() @IsNotEmpty() @MaxLength(2000) reason!: string;
}
