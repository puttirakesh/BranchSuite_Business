import { ArrayUnique, IsArray, IsUUID } from 'class-validator';

export class ReplaceCompanyAccessDto {
  @IsUUID('4')
  companyId!: string;

  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  branchIds!: string[];
}
