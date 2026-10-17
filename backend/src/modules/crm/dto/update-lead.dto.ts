
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
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name?: string;

  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsEmail()
  @MaxLength(255)
  email?: string | null;

  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(20)
  phone?: string | null;

  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(500)
  address?: string | null;

  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsUUID('4')
  branchId?: string | null;
}
