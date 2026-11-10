import { IsString, Matches, MaxLength } from 'class-validator';

export class VerifyCheckoutDto {
  @IsString()
  @Matches(/^pay_[A-Za-z0-9]+$/)
  @MaxLength(80)
  razorpayPaymentId!: string;

  @IsString()
  @Matches(/^sub_[A-Za-z0-9]+$/)
  @MaxLength(80)
  razorpaySubscriptionId!: string;

  @IsString()
  @Matches(/^[a-fA-F0-9]{64}$/)
  razorpaySignature!: string;
}
