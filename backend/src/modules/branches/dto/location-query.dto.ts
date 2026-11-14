import { Type } from 'class-transformer';
import { IsNumber, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class LocationSearchQuery {
  @IsString() @MinLength(3) @MaxLength(120)
  q!: string;
}
export class LocationReverseQuery {
  @Type(() => Number) @IsNumber({ allowNaN: false, allowInfinity: false }) @Min(-90) @Max(90)
  latitude!: number;
  @Type(() => Number) @IsNumber({ allowNaN: false, allowInfinity: false }) @Min(-180) @Max(180)
  longitude!: number;
}
