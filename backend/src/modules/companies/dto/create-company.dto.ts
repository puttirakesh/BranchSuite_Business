import { ManualText, ManualName } from '../../../common/validation/manual-text';

import {
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateCompanyDto {
  @ManualName() @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;
}
