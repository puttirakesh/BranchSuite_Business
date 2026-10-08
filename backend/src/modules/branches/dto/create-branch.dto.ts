
import {
  IsNotEmpty,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateBranchDto {
  @IsUUID('4')
  companyId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;
}
