import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class CreateLeaveTypeDto {
  @IsUUID('4') companyId!: string;
  @IsString() @IsNotEmpty() @MaxLength(30) code!: string;
  @IsString() @IsNotEmpty() @MaxLength(100) name!: string;
  @IsOptional() @IsBoolean() isPaid?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(366) annualAllowance?: number;
}
