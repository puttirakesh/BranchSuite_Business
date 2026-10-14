import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ListLeaveBalancesDto {
  @IsUUID('4') companyId!: string;
  @IsUUID('4') branchId!: string;
  @IsUUID('4') userId!: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(2000) @Max(2100) year?: number;
}
