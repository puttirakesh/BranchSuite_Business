import { ManualText, ManualName } from '../../../common/validation/manual-text';
import { IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

export class CreateBranchDto {
  @IsUUID('4')
  companyId!: string;

  @ManualName() @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  // Optional for older clients. Backend will generate a stable branch code.
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
