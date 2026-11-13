import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsEnum, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { SalaryComponentKind } from '@prisma/client';
import { ManualName, ManualText } from '../../../common/validation/manual-text';

export class SalaryBreakdownComponentDto {
  @ManualText() @IsString() @Matches(/^[A-Za-z0-9_]{1,30}$/) code!: string;
  @ManualName() @IsString() @MinLength(1) @MaxLength(100) name!: string;
  @IsEnum(SalaryComponentKind) kind!: SalaryComponentKind;
  @ManualText() @IsString() @Matches(/^\d{1,12}(\.\d{1,2})?$/) amount!: string;
}

export class SalaryBreakdownPreviewDto {
  @IsUUID('4') companyId!: string;
  @ManualText() @IsString() @Matches(/^(?!0+(?:\.0+)?$)\d{1,12}(\.\d{1,2})?$/, { message: 'Monthly gross salary must be greater than zero' }) monthlyGross!: string;
  @IsOptional() @IsArray() @ArrayMaxSize(40) @ValidateNested({ each: true }) @Type(() => SalaryBreakdownComponentDto) components?: SalaryBreakdownComponentDto[];
}
