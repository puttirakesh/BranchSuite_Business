import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class UpdateBranchDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{2,20}$/)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  manager?: string;
}
