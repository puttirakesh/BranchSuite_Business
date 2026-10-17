
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
  IsEnum,
  IsISO8601,
  ValidateNested,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LeadStage } from '@prisma/client';

import { LeadFieldsDto } from './lead-fields.dto';

class LeadOpportunityDto {
  @IsString() @IsNotEmpty() @MaxLength(200) title!: string;
  @IsOptional() @Matches(/^(0|[1-9]\d{0,15})(\.\d{1,2})?$/) amount?: string;
}

export class CreateLeadDto extends LeadFieldsDto {
  @IsOptional() @IsEnum(LeadStage) stage?: LeadStage;
  @IsOptional() @IsISO8601() followUpAt?: string;
  @IsOptional() @ValidateNested() @Type(() => LeadOpportunityDto) opportunity?: LeadOpportunityDto;
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
