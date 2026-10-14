
import {
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

export class CreateAdvanceDto {
  @IsUUID("4")
  companyId!: string;

  @IsUUID("4")
  branchId!: string;

  @IsString()
  @Matches(/^\d{1,12}(\.\d{1,2})?$/, {
    message:
      "Amount must be a positive decimal string with at most two decimal places",
  })
  amount!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason!: string;
}

export class ReviewAdvanceDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
