
import {
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';

export class ResetPasswordDto {
  // Secure token received through the password reset email
  @IsString()
  @IsNotEmpty({
    message: 'Password reset token is required',
  })
  @MaxLength(256)
  token!: string;

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
  newPassword!: string;

  // Confirm the new password
  @IsString()
  @IsNotEmpty({
    message: 'Please confirm your new password',
  })
  @Matches(/^.{8,128}$/s, {
    message: 'Confirmation must contain 8 to 128 characters',
  })
  confirmPassword!: string;
}
