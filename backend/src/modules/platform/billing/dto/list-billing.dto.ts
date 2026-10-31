import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';

export class ListBillingDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page: number = 1;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit: number = 20;

  @IsOptional() @IsString() @MaxLength(100)
  search?: string;

  @IsOptional() @IsUUID()
  tenantId?: string;

  @IsOptional() @IsUUID()
  companyId?: string;

  @IsOptional() @IsString() @Matches(/^[A-Z_]{1,20}$/)
  status?: string;

  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;

  @IsOptional() @Matches(/^[A-Z]{3}$/)
  currency?: string;
}
