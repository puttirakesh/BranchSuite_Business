import { ManualText } from '../../../common/validation/manual-text';
import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateLeadHistoryDto {
  @ManualText() @IsString() @IsNotEmpty() @MaxLength(100) id!: string;
  @IsIn(['edit', 'opportunity', 'customer', 'stage']) kind!: string;
  @ManualText() @IsString() @IsNotEmpty() @MaxLength(1000) note!: string;
}
