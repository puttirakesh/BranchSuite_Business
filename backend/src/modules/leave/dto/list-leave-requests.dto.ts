import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { LeaveRequestStatus } from '@prisma/client';
import { Type } from 'class-transformer';

export class ListLeaveRequestsDto {
  @IsOptional() @IsUUID('4') companyId?: string;
  @IsOptional() @IsUUID('4') branchId?: string;
  @IsOptional() @IsUUID('4') userId?: string;
  @IsOptional() @IsEnum(LeaveRequestStatus) status?: LeaveRequestStatus;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit: number = 20;
}
