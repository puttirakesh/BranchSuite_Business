
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class CreateLeadDto {
  @IsUUID('4')
  @IsNotEmpty()
  companyId!: string;

  @IsOptional()
  @IsUUID('4')
  branchId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsUUID('4')
  assignedToId?: string | null;
}
