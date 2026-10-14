import { IsInt, IsUUID, Max, Min } from 'class-validator';

export class AllocateLeaveBalanceDto {
  @IsUUID('4') companyId!: string;
  @IsUUID('4') branchId!: string;
  @IsUUID('4') userId!: string;
  @IsUUID('4') leaveTypeId!: string;
  @IsInt() @Min(2000) @Max(2100) year!: number;
  @IsInt() @Min(0) @Max(366) allocatedDays!: number;
}
