import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/gaurds/jwt-auth.guard';
import { BusinessAdminGuard } from '../auth/gaurds/business-admin.guard';
import { planLimits, planUsage } from '../../common/plan-limits';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { HostedCallbackDto, VerifyPaymentDto } from './dto/verify-payment.dto';
import { renderCheckoutPage } from './checkout-page';
import { SubscriptionsService } from './subscriptions.service';
import { AllowPendingSubscription } from '../auth/decorators/allow-pending-subscription.decorator';

type OwnerRequest = {
  authUser: { id: string; tenantId: string; roles: string[] };
  headers: Record<string, string | string[] | undefined>;
};

/** Public API base (…/api/v1) used to build the hosted checkout link. */
export function publicApiBase(request: {
  headers: Record<string, string | string[] | undefined>;
}): string {
  const configured = process.env.PUBLIC_API_BASE_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  const host = String(request.headers.host ?? 'localhost');
  const local = /^(localhost|127\.|10\.|192\.168\.)/.test(host);
  return `${local ? 'http' : 'https'}://${host}/api/v1`;
}

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
      select: { id: true, planId: true, billingCycle: true, status: true, createdAt: true, updatedAt: true, activatedAt: true, currentPeriodEnd: true, expiresAt: true, lastPaymentAt: true, cancelAtPeriodEnd: true },
    });
    if (!subscription) return null;
    const [limits, usage] = await Promise.all([planLimits(this.prisma, tenantId), planUsage(this.prisma, tenantId)]);
    return { ...subscription, limits, usage };
  }

  // Billing endpoints: owner only, reachable while the subscription is inactive
  // (that is how a pending or expired owner pays).

  @Get('status')
  @UseGuards(JwtAuthGuard)
  @AllowPendingSubscription()
  status(@Req() request: OwnerRequest) {
    this.subscriptions.assertOwner(request.authUser);
    return this.subscriptions.status(request.authUser);
  }

  @Get('pending')
  @UseGuards(JwtAuthGuard)
  @AllowPendingSubscription()
  pending(@Req() request: OwnerRequest) {
    this.subscriptions.assertOwner(request.authUser);
    return this.subscriptions.pendingCheckout(request.authUser);
  }

  /** Creates (or reuses) a one-time Razorpay order for activation or renewal. */
  @Post('orders')
  @UseGuards(JwtAuthGuard)
  @AllowPendingSubscription()
  createOrder(@Req() request: OwnerRequest, @Body() body: CreateOrderDto) {
    this.subscriptions.assertOwner(request.authUser);
    return this.subscriptions.createOrder(request.authUser, body, publicApiBase(request));
  }

  /** Verifies a Standard Checkout result; access is granted only if captured. */
  @Post('payments/verify')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @AllowPendingSubscription()
  verifyPayment(@Req() request: OwnerRequest, @Body() body: VerifyPaymentDto) {
    this.subscriptions.assertOwner(request.authUser);
    return this.subscriptions.verifyPayment(request.authUser, body);
  }

  /** Re-reads open orders from Razorpay (webhook-independent). */
  @Post('refresh')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @AllowPendingSubscription()
  refresh(@Req() request: OwnerRequest) {
    this.subscriptions.assertOwner(request.authUser);
    return this.subscriptions.refresh(request.authUser);
  }
}

/**
 * Hosted checkout for native apps. No JWT: access is a short-lived HMAC token
 * bound to ONE order, and payment is still confirmed server-side.
 */
@Controller('subscriptions')
export class HostedCheckoutController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get('checkout-page/:orderId')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  @Header('Referrer-Policy', 'no-referrer')
  @Header('X-Content-Type-Options', 'nosniff')
  async page(
    @Req() request: { headers: Record<string, string | string[] | undefined> },
    @Param('orderId', new ParseUUIDPipe()) orderId: string,
    @Query('t') token?: string,
  ) {
    const details = await this.subscriptions.hostedCheckoutDetails(orderId, token);
    const base = publicApiBase(request);
    return renderCheckoutPage({
      ...details,
      callbackUrl: `${base}/subscriptions/checkout-callback/${orderId}?t=${encodeURIComponent(token ?? '')}`,
      returnUrl: 'branchsuitebusiness://billing',
    });
  }

  @Post('checkout-callback/:orderId')
  @HttpCode(200)
  callback(
    @Param('orderId', new ParseUUIDPipe()) orderId: string,
    @Query('t') token: string | undefined,
    @Body() body: HostedCallbackDto,
  ) {
    return this.subscriptions.hostedCheckoutCallback(orderId, token, body);
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
    return this.subscriptions.processWebhook(request.rawBody, signature, eventId);
  }
}
