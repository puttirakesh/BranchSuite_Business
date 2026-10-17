import { IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

export class CreateBranchDto {
  @IsUUID('4')
  companyId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  // Optional for older clients. Backend will generate a stable branch code.
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
