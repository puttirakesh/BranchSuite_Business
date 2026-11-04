import { IsDateString, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ListPlatformAuditDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
  @IsOptional() @IsUUID('4') tenantId?: string;
  @IsOptional() @IsUUID('4') companyId?: string;
  @IsOptional() @IsUUID('4') branchId?: string;
  @IsOptional() @IsUUID('4') actorId?: string;
  @IsOptional() @IsString() @MaxLength(60) module?: string;
  @IsOptional() @IsString() @MaxLength(100) action?: string;
  @IsOptional() @IsString() @MaxLength(100) targetId?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}
