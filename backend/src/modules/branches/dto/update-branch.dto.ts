import { ManualText } from '../../../common/validation/manual-text';
import { IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

export class UpdateBranchDto {
  @ManualText() @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name?: string;

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
}
