import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/gaurds/jwt-auth.guard';
import { BusinessAdminGuard } from '../auth/gaurds/business-admin.guard';
import { planLimits, planUsage } from '../../common/plan-limits';
import { PrismaService } from '../../prisma/prisma.service';
import { VerifyCheckoutDto } from './dto/verify-checkout.dto';
import { SubscriptionsService } from './subscriptions.service';
import { AllowPendingSubscription } from '../auth/decorators/allow-pending-subscription.decorator';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(
    private readonly subscriptions: SubscriptionsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('current')
  @UseGuards(JwtAuthGuard, BusinessAdminGuard)
  async current(@Req() request: { authUser: { tenantId: string } }) {
    const tenantId = request.authUser.tenantId;
    const subscription = await this.prisma.businessSubscription.findUnique({
      where: { tenantId },
      select: { id: true, planId: true, billingCycle: true, status: true, createdAt: true, updatedAt: true, activatedAt: true, currentPeriodEnd: true, cancelAtPeriodEnd: true },
    });
    if (!subscription) return null;
    const [limits, usage] = await Promise.all([planLimits(this.prisma, tenantId), planUsage(this.prisma, tenantId)]);
    return { ...subscription, limits, usage };
  }

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  @AllowPendingSubscription()
  createCheckout(@Req() request: { authUser: { id: string; tenantId: string; roles: string[] } }) {
    this.subscriptions.assertOwner(request.authUser);
    return this.subscriptions.createCheckout(request.authUser);
  }

  @Get('pending')
  @UseGuards(JwtAuthGuard)
  @AllowPendingSubscription()
  pending(@Req() request: { authUser: { id: string; tenantId: string; roles: string[] } }) {
    this.subscriptions.assertOwner(request.authUser);
    return this.subscriptions.pendingCheckout(request.authUser);
  }

  @Get('status')
  @UseGuards(JwtAuthGuard)
  @AllowPendingSubscription()
  status(@Req() request: { authUser: { id: string; tenantId: string; roles: string[] } }) {
    this.subscriptions.assertOwner(request.authUser);
    return this.subscriptions.status(request.authUser);
  }

  /** Pulls Razorpay's current state and reconciles it (webhook-independent). */
  @Post('refresh')
  @UseGuards(JwtAuthGuard)
  @AllowPendingSubscription()
  refresh(@Req() request: { authUser: { id: string; tenantId: string; roles: string[] } }) {
    this.subscriptions.assertOwner(request.authUser);
    return this.subscriptions.refresh(request.authUser);
  }

  @Post('verify')
  @UseGuards(JwtAuthGuard)
  @AllowPendingSubscription()
  verifyCheckout(
    @Req() request: { authUser: { id: string; tenantId: string; roles: string[] } },
    @Body() body: VerifyCheckoutDto,
  ) {
    this.subscriptions.assertOwner(request.authUser);
    return this.subscriptions.verifyCheckout(request.authUser, body);
  }
}

@Controller('subscriptions/webhooks')
export class RazorpayWebhookController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  // Razorpay treats any 2xx as delivered; 200 is the conventional acknowledgement.
  @Post('razorpay')
  @HttpCode(200)
  processRazorpayWebhook(
    @Req()
    request: {
      rawBody?: Buffer;
      headers: Record<string, string | string[] | undefined>;
    },
    @Headers('x-razorpay-signature') signature?: string,
    @Headers('x-razorpay-event-id') eventId?: string,
  ) {
    return this.subscriptions.processWebhook(
      request.rawBody,
      signature,
      eventId,
    );
  }
}
