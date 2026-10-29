import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { ManualText } from '../../../common/validation/manual-text';
export class ReassignLeaveDto {
  @IsUUID('4') managerId!: string;
  @ManualText() @IsString() @MinLength(3) @MaxLength(500) reason!: string;
}
