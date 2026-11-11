import { IsString, Matches, MaxLength } from 'class-validator';

/** Razorpay Standard Checkout success response for an ORDER payment. */
export class VerifyPaymentDto {
  @IsString()
  @Matches(/^order_[A-Za-z0-9]+$/)
  @MaxLength(80)
  razorpayOrderId!: string;

  @IsString()
  @Matches(/^pay_[A-Za-z0-9]+$/)
  @MaxLength(80)
  razorpayPaymentId!: string;

  @IsString()
  @Matches(/^[a-fA-F0-9]{64}$/)
  razorpaySignature!: string;
}

/** Posted by the hosted checkout page (order comes from the URL + signed token). */
export class HostedCallbackDto {
  @IsString()
  @Matches(/^pay_[A-Za-z0-9]+$/)
  @MaxLength(80)
  razorpayPaymentId!: string;

  @IsString()
  @Matches(/^[a-fA-F0-9]{64}$/)
  razorpaySignature!: string;
}
