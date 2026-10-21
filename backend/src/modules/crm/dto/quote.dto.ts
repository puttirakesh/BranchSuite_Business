import { ManualText } from '../../../common/validation/manual-text';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';

export enum QuoteStatus { DRAFT='DRAFT', SENT='SENT', ACCEPTED='ACCEPTED', REJECTED='REJECTED', CANCELLED='CANCELLED' }
export class QuoteItemDto {
  @ManualText() @IsString() @IsNotEmpty() @MaxLength(300) description!: string;
  @IsInt() @Min(1) @Max(1000000) quantity!: number;
  @Matches(/^(0|[1-9]\d{0,13})(\.\d{1,2})?$/) unitPrice!: string;
}
export class CreateQuoteDto {
  @IsUUID('4') dealId!: string;
  @ManualText() @IsString() @IsNotEmpty() @MaxLength(180) title!: string;
  @ManualText() @IsOptional() @IsString() @MaxLength(2500) notes?: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({each:true}) @Type(()=>QuoteItemDto) items!: QuoteItemDto[];
}
export class UpdateQuoteDto {
  @IsInt() @Min(1) expectedVersion!: number;
  @ManualText() @IsString() @IsNotEmpty() @MaxLength(180) title!: string;
  @ManualText() @IsOptional() @IsString() @MaxLength(2500) notes?: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({each:true}) @Type(()=>QuoteItemDto) items!: QuoteItemDto[];
}
export class ChangeQuoteStatusDto {
  @IsEnum(QuoteStatus) status!: QuoteStatus;
  @IsInt() @Min(1) expectedVersion!: number;
}
