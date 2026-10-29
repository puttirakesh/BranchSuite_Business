import { Matches } from 'class-validator';
import { ManualText, ManualName } from '../../../common/validation/manual-text';

import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';

import { LeadFieldsDto } from './lead-fields.dto';

export class UpdateLeadDto extends LeadFieldsDto {
  @ManualName() @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name?: string;

  @ManualText() @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsEmail()
  @MaxLength(255)
  email?: string | null;

  @Matches(/^[0-9]{10}$/, { message: 'Phone number must contain exactly 10 digits' }) @ManualText() @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(20)
  phone?: string | null;

  @ManualText() @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(500)
  address?: string | null;

  @ManualText() @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsUUID('4')
  branchId?: string | null;
}
