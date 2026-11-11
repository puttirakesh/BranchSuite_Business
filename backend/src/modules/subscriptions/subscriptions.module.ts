import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import {
  HostedCheckoutController,
  RazorpayWebhookController,
  SubscriptionsController,
} from './subscriptions.controller';
import { RAZORPAY_PROVIDER, RazorpayHttpProvider } from './razorpay.provider';
import { SubscriptionsService } from './subscriptions.service';

@Module({
  imports: [AuthModule],
  controllers: [
    SubscriptionsController,
    HostedCheckoutController,
    RazorpayWebhookController,
  ],
  providers: [
    SubscriptionsService,
    RazorpayHttpProvider,
    { provide: RAZORPAY_PROVIDER, useExisting: RazorpayHttpProvider },
  ],
})
export class SubscriptionsModule {}
