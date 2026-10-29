import { ManualText } from '../../../common/validation/manual-text';
import { IsEmail, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class OtpDestinationDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsEmail()
  @MaxLength(254)
  email!: string;
}

export class VerifyOtpDto {
  @IsUUID()
  challengeId!: string;

  @ManualText() @IsString()
  @Matches(/^[0-9]{6}$/, { message: 'Enter the six-digit OTP' })
  otp!: string;
}
