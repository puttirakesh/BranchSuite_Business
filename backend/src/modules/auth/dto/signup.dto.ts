import { ManualText } from '../../../common/validation/manual-text';

import {
  IsEmail,
  IsUUID,
  IsIn,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class SignupDto {
  @IsUUID()
  emailChallengeId!: string;
  @Matches(/^[0-9]{6}$/)
  emailOtp!: string;

  @ManualText() @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  businessName!: string;

  @ManualText() @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  @Matches(/^[^\u0000-\u001F\u007F]+$/, {
    message: 'Branch name contains invalid characters',
  })
  branchName!: string;

  @ManualText() @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  ownerName!: string;

  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ManualText() @IsString()
  @Matches(/^[0-9]{10}$/, {
    message: 'Mobile number must contain exactly 10 digits',
  })
  phone!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsIn(['starter', 'growth', 'scale'])
  planId!: 'starter' | 'growth' | 'scale';

  @IsIn(['monthly', 'annual'])
  billingCycle!: 'monthly' | 'annual';
}
