import { IsNumber, IsOptional, Max, Min } from 'class-validator';

export class BranchCoordinatesDto {
  @IsOptional() @IsNumber({ allowNaN: false, allowInfinity: false }) @Min(-90) @Max(90)
  latitude?: number | null;

  @IsOptional() @IsNumber({ allowNaN: false, allowInfinity: false }) @Min(-180) @Max(180)
  longitude?: number | null;
}
