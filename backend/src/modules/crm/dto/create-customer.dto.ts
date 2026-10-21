import { Matches } from 'class-validator';
import { ManualText } from '../../../common/validation/manual-text';

import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateCustomerDto {
  @IsUUID('4')
  @IsNotEmpty()
  companyId!: string;

  @IsOptional()
  @IsUUID('4')
  branchId?: string;

  @ManualText() @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @Matches(/^[0-9]{10}$/, { message: 'Phone number must contain exactly 10 digits' }) @ManualText() @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ManualText() @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @ManualText() @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
