import { ManualText } from '../../../common/validation/manual-text';

import {
  Matches,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class LoginDto {
  @IsIn(['staff', 'employee'])
  portal!: 'staff' | 'employee';

  @IsOptional()
  @IsUUID('4')
  tenantId?: string;

  @ManualText() @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  @Matches(/\S/, { message: 'Password must contain a non-space character' })
  password!: string;
}
