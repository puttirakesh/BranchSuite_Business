import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class ListPlatformCustomersDto {
  @IsOptional() @IsString() @MaxLength(100)
  search?: string;

  @IsOptional() @IsIn(['ACTIVE', 'INACTIVE'])
  status?: 'ACTIVE' | 'INACTIVE';

  @IsOptional() @Transform(({ value }) => Number(value))
  @IsInt() @Min(1) @Max(1000000)
  page: number = 1;

  @IsOptional() @Transform(({ value }) => Number(value))
  @IsInt() @Min(1) @Max(100)
  limit: number = 20;
}
