import { ManualText } from '../../../common/validation/manual-text';
import { ArrayMaxSize, ArrayUnique, IsArray, IsOptional, IsString, IsUUID, Matches, MaxLength, ValidateIf } from 'class-validator';

export class LeadFieldsDto {
  @ManualText() @IsOptional() @IsString() @MaxLength(150)
  contactPerson?: string;

  @ManualText() @IsOptional() @IsString() @MaxLength(100)
  source?: string;

  @IsOptional() @Matches(/^(0|[1-9]\d{0,15})(\.\d{1,2})?$/)
  estimatedValue?: string;

  @ValidateIf((_object, value) => value !== undefined) @IsArray() @ArrayMaxSize(100) @ArrayUnique() @IsUUID('4', { each: true })
  assignedEmployeeIds?: string[];
}
