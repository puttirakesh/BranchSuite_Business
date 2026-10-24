import { ManualText } from '../../../common/validation/manual-text';

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

  @ManualText() @IsString()
  @Matches(/^\d{1,12}(\.\d{1,2})?$/, {
    message:
      "Amount must be a positive decimal string with at most two decimal places",
  })
  amount!: string;

  @ManualText() @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason!: string;
}

export class ReviewAdvanceDto {
  @ManualText() @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class DisburseAdvanceDto {
  @IsString() @MinLength(3) @MaxLength(200) reference!: string;
  @IsString() @Matches(/^\d{1,12}(\.\d{1,2})?$/) recoveryMonthly!: string;
  @IsString() @Matches(/^\d{4}-(0[1-9]|1[0-2])$/) recoveryStart!: string;
}
