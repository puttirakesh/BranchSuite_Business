import { VerifyOtpDto } from './otp.dto';

import {
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';

export class ResetPasswordDto extends VerifyOtpDto {
  // New password entered by the user
  @IsString()
  @IsNotEmpty({
    message: 'New password is required',
  })
  @MinLength(8, {
    message: 'Password must contain at least 8 characters',
  })
  @MaxLength(128, {
    message: 'Password must not exceed 128 characters',
  })
  @Matches(/\S/, { message: 'Password must contain a non-space character' })
  newPassword!: string;

  // Confirm the new password
  @IsString()
  @IsNotEmpty({
    message: 'Please confirm your new password',
  })
  @Matches(/^.{8,128}$/s, {
    message: 'Confirmation must contain 8 to 128 characters',
  })
  @Matches(/\S/, { message: 'Password must contain a non-space character' })
  confirmPassword!: string;
}
