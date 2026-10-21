import { ManualText } from '../../../common/validation/manual-text';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewLeaveDto {
  @ManualText() @IsOptional() @IsString() @MaxLength(2000) note?: string;
}
