import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewLeaveDto {
  @IsOptional() @IsString() @MaxLength(2000) note?: string;
}
