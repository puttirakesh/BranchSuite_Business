import { Type } from 'class-transformer';
import {
  IsBoolean, IsDateString, IsIn, IsInt, IsNotEmpty, IsNumber,
  IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength,
  ValidateIf,
} from 'class-validator';

export const OFFER_STATUSES = ['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED'] as const;
export const DISCOUNT_TYPES = ['PERCENT', 'FIXED'] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

export class CreateMarketingOfferDto {
  @IsString() @MinLength(3) @MaxLength(120)
  title!: string;

  @IsString() @MinLength(3) @MaxLength(1000)
  description!: string;

  @IsString() @Matches(/^[A-Z0-9][A-Z0-9_-]{2,39}$/)
  code!: string;

  @IsIn(DISCOUNT_TYPES)
  discountType!: DiscountType;

  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(9999999999)
  discountValue!: number;

  @IsDateString()
  startsAt!: string;

  @IsDateString()
  endsAt!: string;

  // Null means global; these IDs are descriptive scope only until redemption is implemented.
  @ValidateIf((_o, value) => value !== undefined && value !== null)
  @IsString() @Matches(/^[0-9a-f-]{36}$/i)
  tenantId?: string | null;

  @ValidateIf((_o, value) => value !== undefined && value !== null)
  @IsString() @Matches(/^[0-9a-f-]{36}$/i)
  companyId?: string | null;

  @IsOptional() @IsInt() @Min(1) @Max(1000000)
  usageLimit?: number;
}

export class UpdateMarketingOfferDto {
  @ValidateIf((_o, value) => value !== undefined)
  @IsString() @MinLength(3) @MaxLength(120)
  title?: string;

  @ValidateIf((_o, value) => value !== undefined)
  @IsString() @MinLength(3) @MaxLength(1000)
  description?: string;

  @ValidateIf((_o, value) => value !== undefined)
  @IsDateString()
  startsAt?: string;

  @ValidateIf((_o, value) => value !== undefined)
  @IsDateString()
  endsAt?: string;

  @ValidateIf((_o, value) => value !== undefined)
  @IsInt() @Min(1) @Max(1000000)
  usageLimit?: number;
}

export class UpdateOfferStatusDto {
  @IsIn(OFFER_STATUSES)
  status!: OfferStatus;
}

export class ListOffersDto {
  @IsOptional() @IsString() @MaxLength(100)
  search?: string;

  @IsOptional() @IsIn(OFFER_STATUSES)
  status?: OfferStatus;

  @IsOptional() @IsIn(DISCOUNT_TYPES)
  discountType?: DiscountType;

  @IsOptional() @IsString()
  tenantId?: string;

  @IsOptional() @IsString()
  companyId?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit?: number;
}
