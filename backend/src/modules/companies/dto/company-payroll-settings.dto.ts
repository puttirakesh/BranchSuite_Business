import { ManualText } from '../../../common/validation/manual-text';
import { ArrayMaxSize, ArrayUnique, IsArray, IsBoolean, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

export class PayslipSettingsDto {
  @IsInt() @Min(1) version!: number;
  @ManualText() @IsOptional() @IsString() @MaxLength(500) address?: string;
  @IsOptional() @IsString() @MaxLength(180000) @Matches(/^(data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+)?$/) logoDataUrl?: string;
  @ManualText() @IsOptional() @Matches(/^#[0-9A-Fa-f]{6}$/) accentColor?: string;
  @ManualText() @IsOptional() @IsString() @MaxLength(250) footer?: string;
  @IsOptional() @IsBoolean() showBankDetails?: boolean;
  @IsOptional() @IsBoolean() showIdentifiers?: boolean;
  @IsOptional() @IsBoolean() showPaidDays?: boolean;
  @IsOptional() @IsBoolean() showDepartment?: boolean;
  @IsOptional() @IsBoolean() showDesignation?: boolean;
  @IsOptional() @IsBoolean() showBranch?: boolean;
}

export class PayrollCalendarDto {
  @IsArray() @ArrayUnique() @ArrayMaxSize(7) @IsInt({ each: true }) @Min(0, { each: true }) @Max(6, { each: true }) weeklyOffDays!: number[];
  @IsArray() @ArrayUnique() @ArrayMaxSize(800) @IsString({ each: true }) @Matches(/^\d{4}-\d{2}-\d{2}$/, { each: true }) holidays!: string[];
}
