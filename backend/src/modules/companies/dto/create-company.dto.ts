import { ManualText } from '../../../common/validation/manual-text';

import {
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateCompanyDto {
  @ManualText() @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;
}
