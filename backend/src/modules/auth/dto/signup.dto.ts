import { ManualText, ManualName } from '../../../common/validation/manual-text';

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
  @ManualText() @Matches(/^[0-9]{6}$/)
  emailOtp!: string;

  @ManualName() @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  businessName!: string;

  @ManualName() @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  @Matches(/^[^\u0000-\u001F\u007F]+$/, {
    message: 'Branch name contains invalid characters',
  })
  branchName!: string;

  @ManualName() @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  ownerName!: string;

  @ManualText() @IsEmail()
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
  @Matches(/\S/, { message: 'Password must contain a non-space character' })
  password!: string;

  @IsIn(['starter', 'growth', 'scale'])
  planId!: 'starter' | 'growth' | 'scale';

  @IsIn(['monthly', 'annual'])
  billingCycle!: 'monthly' | 'annual';
}
