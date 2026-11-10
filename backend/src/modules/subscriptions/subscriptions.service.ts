import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Prisma, type SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  getSubscriptionPlan,
  type SubscriptionBillingCycle,
  type SubscriptionPlanId,
} from './subscription-catalog';
import {
  configuredRazorpayPlanId,
  RAZORPAY_PROVIDER,
  type RazorpayProvider,
  type RazorpaySubscription,
} from './razorpay.provider';

type OwnerContext = { id: string; tenantId: string; roles: string[] };

type PaymentInput = {
  id: string;
  providerSubscriptionId: string;
  amount: number;
  currency: string;
  status: string;
  errorCode?: string | null;
  errorDescription?: string | null;
  createdAt?: number;
  capturedAt?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function unixDate(value: number | null | undefined): Date | undefined {
  return typeof value === 'number' && value > 0
    ? new Date(value * 1000)
    : undefined;
}

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(RAZORPAY_PROVIDER)
    private readonly razorpay: RazorpayProvider,
  ) {}

  assertOwner(owner: OwnerContext): void {
    if (!owner.roles.includes('BUSINESS_OWNER')) {
      throw new ForbiddenException(
        'Only the business owner can manage subscription payments.',
      );
    }
  }

  async pendingCheckout(owner: OwnerContext) {
    await this.expireEndedSubscription(owner.tenantId);
    const subscription = await this.prisma.businessSubscription.findUnique({
      where: { tenantId: owner.tenantId },
      include: {
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });
    if (!subscription) {
      throw new NotFoundException('No business subscription was found.');
    }
    const { plan, billingCycle, amountPaise } = this.planFor(subscription);
    return {
      subscriptionId: subscription.id,
      plan: { id: plan.id, name: plan.name },
      billingCycle,
      amountPaise,
      currency: 'INR',
      status: subscription.status,
      providerStatus: subscription.providerStatus,
      razorpaySubscriptionId: subscription.razorpaySubscriptionId,
      keyId: subscription.razorpaySubscriptionId
        ? this.razorpay.publicKeyId()
        : null,
      checkoutUrl: subscription.providerCheckoutUrl,
      paymentHistory: subscription.payments,
    };
  }

  async status(owner: OwnerContext) {
    return this.pendingCheckout(owner);
  }

  async createCheckout(owner: OwnerContext) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`razorpay-checkout:${owner.tenantId}`})::bigint)`;

      const subscription = await tx.businessSubscription.findUnique({
        where: { tenantId: owner.tenantId },
      });
      if (!subscription) {
        throw new NotFoundException('No pending business subscription was found.');
      }
      if (
        subscription.status !== 'PENDING_ACTIVATION' &&
        subscription.status !== 'PAST_DUE'
      ) {
        throw new ConflictException(
          'This subscription is not awaiting payment or payment recovery.',
        );
      }

      const { plan, billingCycle, amountPaise } = this.planFor(subscription);
      if (
        subscription.razorpaySubscriptionId &&
        ['created', 'authenticated', 'active'].includes(
          subscription.providerStatus ?? '',
        )
      ) {
        return {
          subscriptionId: subscription.id,
          razorpaySubscriptionId: subscription.razorpaySubscriptionId,
          checkoutUrl: subscription.providerCheckoutUrl,
          keyId: this.razorpay.publicKeyId(),
          plan: { id: plan.id, name: plan.name },
          billingCycle,
          amountPaise,
          currency: 'INR',
        };
      }

      const razorpaySubscription = await this.razorpay.createSubscription({
        planId: plan.id,
        billingCycle,
        tenantId: owner.tenantId,
      });
      await tx.businessSubscription.update({
        where: { id: subscription.id },
        data: {
          razorpaySubscriptionId: razorpaySubscription.id,
          providerStatus: razorpaySubscription.status,
          providerCheckoutUrl: razorpaySubscription.short_url ?? null,
          cancelAtPeriodEnd: false,
          cancelledAt: null,
          expiresAt: null,
        },
      });

      return {
        subscriptionId: subscription.id,
        razorpaySubscriptionId: razorpaySubscription.id,
        checkoutUrl: razorpaySubscription.short_url ?? null,
        keyId: this.razorpay.publicKeyId(),
        plan: { id: plan.id, name: plan.name },
        billingCycle,
        amountPaise,
        currency: 'INR',
      };
    });
  }

  async verifyCheckout(
    owner: OwnerContext,
    input: {
      razorpayPaymentId: string;
      razorpaySubscriptionId: string;
      razorpaySignature: string;
    },
  ) {
    if (
      !/^pay_[A-Za-z0-9]+$/.test(input.razorpayPaymentId) ||
      !/^sub_[A-Za-z0-9]+$/.test(input.razorpaySubscriptionId) ||
      !/^[a-fA-F0-9]{64}$/.test(input.razorpaySignature)
    ) {
      throw new BadRequestException('Invalid Razorpay checkout response.');
    }

    const record = await this.prisma.businessSubscription.findUnique({
      where: { tenantId: owner.tenantId },
    });
    if (
      !record ||
      record.razorpaySubscriptionId !== input.razorpaySubscriptionId
    ) {
      throw new ForbiddenException(
        'The checkout subscription does not belong to this business account.',
      );
    }
    if (
      record.status !== 'PENDING_ACTIVATION' &&
      record.status !== 'PAST_DUE' &&
      record.status !== 'ACTIVE'
    ) {
      throw new ConflictException(
        'This subscription is not awaiting payment verification.',
      );
    }

    this.verifyCheckoutSignature(
      input.razorpayPaymentId,
      input.razorpaySubscriptionId,
      input.razorpaySignature,
    );
    const [payment, razorpaySubscription] = await Promise.all([
      this.razorpay.getPayment(input.razorpayPaymentId),
      this.razorpay.getSubscription(input.razorpaySubscriptionId),
    ]);
    if (
      payment.id !== input.razorpayPaymentId ||
      razorpaySubscription.id !== input.razorpaySubscriptionId
    ) {
      throw new ForbiddenException(
        'Razorpay returned a payment or subscription that does not match this checkout.',
      );
    }

    const { amountPaise } = this.planFor(record);
    const paymentSubscriptionId = payment.subscription_id;
    if (
      !paymentSubscriptionId ||
      paymentSubscriptionId !== input.razorpaySubscriptionId
    ) {
      throw new ForbiddenException(
        'The Razorpay payment is not linked to this subscription.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await this.savePayment(tx, {
        id: payment.id,
        subscriptionRecordId: record.id,
        providerSubscriptionId: paymentSubscriptionId,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        errorCode: payment.error_code,
        errorDescription: payment.error_description,
        createdAt: payment.created_at,
        capturedAt: payment.captured_at ?? undefined,
      });
      await this.applyProviderSubscriptionState(
        tx,
        record,
        razorpaySubscription,
        {
          id: payment.id,
          providerSubscriptionId: paymentSubscriptionId,
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status,
          errorCode: payment.error_code,
          errorDescription: payment.error_description,
          createdAt: payment.created_at,
          capturedAt: payment.captured_at ?? undefined,
        },
        amountPaise,
      );
    });

    const updated = await this.prisma.businessSubscription.findUnique({
      where: { id: record.id },
      select: { status: true, providerStatus: true, activatedAt: true },
    });
    return {
      verified: true,
      activated: updated?.status === 'ACTIVE',
      status: updated?.status ?? record.status,
      providerStatus: updated?.providerStatus ?? razorpaySubscription.status,
      activatedAt: updated?.activatedAt ?? null,
      message:
        updated?.status === 'ACTIVE'
          ? 'Payment confirmed and subscription activated.'
          : 'Checkout was verified, but a captured initial payment has not yet been confirmed.',
    };
  }

  async processWebhook(
    rawBody: Buffer | undefined,
    signature: string | undefined,
    eventId: string | undefined,
  ) {
    if (
      !rawBody?.length ||
      !signature ||
      !eventId ||
      !/^[A-Za-z0-9._-]{1,120}$/.test(eventId)
    ) {
      throw new BadRequestException(
        'A raw webhook body, signature and event ID are required.',
      );
    }
    this.verifyWebhookSignature(rawBody, signature);

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody.toString('utf8')) as unknown;
    } catch {
      throw new BadRequestException('Invalid Razorpay webhook JSON.');
    }
    if (!isRecord(payload) || typeof payload.event !== 'string') {
      throw new BadRequestException('Invalid Razorpay webhook event.');
    }

    const eventType = payload.event;
    const data = isRecord(payload.payload) ? payload.payload : {};
    const paymentEntity = this.entity(data.payment);
    const subscriptionEntity = this.entity(data.subscription);
    const payment = paymentEntity ? this.paymentInput(paymentEntity) : null;
    const providerSubscription = subscriptionEntity
      ? this.providerSubscription(subscriptionEntity)
      : null;

    let fetchedSubscription: RazorpaySubscription | null = null;
    if (
      payment?.providerSubscriptionId &&
      (eventType === 'payment.captured' || eventType === 'subscription.charged')
    ) {
      fetchedSubscription = await this.razorpay.getSubscription(
        payment.providerSubscriptionId,
      );
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.razorpayWebhookEvent.create({
          data: {
            providerEventId: eventId,
            eventType,
            payload: payload as Prisma.InputJsonValue,
          },
        });

        if (
          payment &&
          ['payment.captured', 'subscription.charged', 'payment.failed', 'payment.authorized'].includes(
            eventType,
          )
        ) {
          const subscription = await tx.businessSubscription.findUnique({
            where: {
              razorpaySubscriptionId: payment.providerSubscriptionId,
            },
          });
          if (subscription) {
            await this.savePayment(tx, {
              ...payment,
              subscriptionRecordId: subscription.id,
              status:
                eventType === 'payment.captured' ||
                eventType === 'subscription.charged'
                  ? payment.status === 'captured'
                    ? 'captured'
                    : payment.status
                  : eventType === 'payment.failed'
                    ? 'failed'
                    : 'authorized',
            });
            if (
              fetchedSubscription &&
              (eventType === 'payment.captured' ||
                eventType === 'subscription.charged')
            ) {
              const { amountPaise } = this.planFor(subscription);
              await this.applyProviderSubscriptionState(
                tx,
                subscription,
                fetchedSubscription,
                {
                  ...payment,
                  status: payment.status,
                },
                amountPaise,
              );
            } else if (
              eventType === 'payment.failed' &&
              subscription.status === 'ACTIVE'
            ) {
              await tx.businessSubscription.update({
                where: { id: subscription.id },
                data: { status: 'PAST_DUE' },
              });
            }
          }
        }

        if (providerSubscription?.id) {
          await this.applySubscriptionEvent(
            tx,
            eventType,
            providerSubscription,
          );
        }

        await tx.razorpayWebhookEvent.update({
          where: { providerEventId: eventId },
          data: { processedAt: new Date(), lastError: null },
        });
      });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await this.prisma.razorpayWebhookEvent.findUnique({
          where: { providerEventId: eventId },
          select: { processedAt: true },
        });
        if (existing?.processedAt) {
          return { received: true, duplicate: true };
        }
      }
      throw error;
    }

    return { received: true, duplicate: false };
  }

  private planFor(subscription: {
    planId: string;
    billingCycle: string;
  }) {
    try {
      return getSubscriptionPlan(subscription.planId, subscription.billingCycle);
    } catch {
      throw new ConflictException(
        'The saved subscription plan is invalid. Payment cannot be initiated.',
      );
    }
  }

  private async expireEndedSubscription(tenantId: string): Promise<void> {
    const now = new Date();
    await this.prisma.businessSubscription.updateMany({
      where: {
        tenantId,
        status: 'ACTIVE',
        OR: [
          { expiresAt: { lte: now } },
          { currentPeriodEnd: { lte: now } },
        ],
      },
      data: { status: 'EXPIRED' },
    });
  }

  private verifyCheckoutSignature(
    paymentId: string,
    subscriptionId: string,
    provided: string,
  ): void {
    const secret = process.env.RAZORPAY_KEY_SECRET?.trim();
    if (!secret) {
      throw new ServiceUnavailableException(
        'Razorpay API credentials are not configured.',
      );
    }
    const expected = createHmac('sha256', secret)
      .update(`${paymentId}|${subscriptionId}`)
      .digest();
    const actual = Buffer.from(provided, 'hex');
    if (
      actual.length !== expected.length ||
      !timingSafeEqual(expected, actual)
    ) {
      throw new ForbiddenException('Razorpay checkout signature is invalid.');
    }
  }

  private verifyWebhookSignature(rawBody: Buffer, provided: string): void {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
    if (!secret) {
      throw new ServiceUnavailableException(
        'Razorpay webhook secret is not configured.',
      );
    }
    if (!/^[a-fA-F0-9]{64}$/.test(provided)) {
      throw new ForbiddenException('Razorpay webhook signature is invalid.');
    }
    const expected = createHmac('sha256', secret).update(rawBody).digest();
    const actual = Buffer.from(provided, 'hex');
    if (
      actual.length !== expected.length ||
      !timingSafeEqual(expected, actual)
    ) {
      throw new ForbiddenException('Razorpay webhook signature is invalid.');
    }
  }

  private entity(value: unknown): Record<string, unknown> | null {
    if (!isRecord(value) || !isRecord(value.entity)) return null;
    return value.entity;
  }

  private paymentInput(entity: Record<string, unknown>): PaymentInput | null {
    const id = stringValue(entity.id);
    const providerSubscriptionId = stringValue(entity.subscription_id);
    const amount = numberValue(entity.amount);
    const currency = stringValue(entity.currency);
    const status = stringValue(entity.status);
    if (
      !id ||
      !providerSubscriptionId ||
      amount === undefined ||
      !currency ||
      !status
    ) {
      return null;
    }
    return {
      id,
      providerSubscriptionId,
      amount,
      currency,
      status,
      errorCode: stringValue(entity.error_code) ?? null,
      errorDescription: stringValue(entity.error_description) ?? null,
      createdAt: numberValue(entity.created_at),
      capturedAt: numberValue(entity.captured_at),
    };
  }

  private providerSubscription(
    entity: Record<string, unknown>,
  ): RazorpaySubscription | null {
    const id = stringValue(entity.id);
    const planId = stringValue(entity.plan_id);
    const status = stringValue(entity.status);
    if (!id || !planId || !status) return null;
    return {
      id,
      plan_id: planId,
      status,
      current_start: numberValue(entity.current_start) ?? null,
      current_end: numberValue(entity.current_end) ?? null,
      ended_at: numberValue(entity.ended_at) ?? null,
      cancel_at_cycle_end: entity.cancel_at_cycle_end === true,
    };
  }

  private async savePayment(
    tx: Prisma.TransactionClient,
    payment: PaymentInput & { subscriptionRecordId: string },
  ): Promise<void> {
    const existing = await tx.subscriptionPayment.findUnique({
      where: { providerPaymentId: payment.id },
      select: { status: true },
    });
    if (
      existing?.status === 'CAPTURED' &&
      payment.status.toLowerCase() !== 'captured'
    ) {
      return;
    }
    const status = payment.status.toUpperCase();
    await tx.subscriptionPayment.upsert({
      where: { providerPaymentId: payment.id },
      create: {
        subscriptionId: payment.subscriptionRecordId,
        providerPaymentId: payment.id,
        providerSubscriptionId: payment.providerSubscriptionId,
        amountPaise: payment.amount,
        currency: payment.currency,
        status,
        failureCode: payment.errorCode ?? null,
        failureDescription: payment.errorDescription ?? null,
        capturedAt:
          status === 'CAPTURED'
            ? unixDate(payment.capturedAt) ??
              unixDate(payment.createdAt) ??
              new Date()
            : null,
      },
      update: {
        amountPaise: payment.amount,
        currency: payment.currency,
        status,
        failureCode: payment.errorCode ?? null,
        failureDescription: payment.errorDescription ?? null,
        ...(status === 'CAPTURED'
          ? {
              capturedAt:
                unixDate(payment.capturedAt) ??
                unixDate(payment.createdAt) ??
                new Date(),
            }
          : {}),
      },
    });
  }

  private async applyProviderSubscriptionState(
    tx: Prisma.TransactionClient,
    subscription: {
      id: string;
      planId: string;
      billingCycle: string;
      razorpaySubscriptionId: string | null;
      status: SubscriptionStatus;
      activatedAt: Date | null;
    },
    providerSubscription: RazorpaySubscription,
    payment: PaymentInput,
    expectedAmount: number,
  ): Promise<void> {
    const { plan, billingCycle } = this.planFor(subscription);
    const planMatches =
      providerSubscription.id === subscription.razorpaySubscriptionId &&
      providerSubscription.plan_id ===
        configuredRazorpayPlanId(plan.id, billingCycle);
    const paymentMatches =
      payment.status.toLowerCase() === 'captured' &&
      payment.amount === expectedAmount &&
      payment.currency === 'INR' &&
      payment.providerSubscriptionId === subscription.razorpaySubscriptionId;
    const active = providerSubscription.status === 'active';
    const periodEnd = unixDate(providerSubscription.current_end);
    const scheduledCancellation =
      providerSubscription.cancel_at_cycle_end === true &&
      !!periodEnd &&
      periodEnd.getTime() > Date.now();

    const update: Prisma.BusinessSubscriptionUpdateInput = {
      providerStatus: providerSubscription.status,
      ...(typeof providerSubscription.cancel_at_cycle_end === 'boolean'
        ? { cancelAtPeriodEnd: providerSubscription.cancel_at_cycle_end }
        : {}),
      ...(unixDate(providerSubscription.current_start)
        ? { currentPeriodStart: unixDate(providerSubscription.current_start) }
        : {}),
      ...(periodEnd
        ? { currentPeriodEnd: periodEnd }
        : {}),
      ...(unixDate(providerSubscription.ended_at)
        ? { expiresAt: unixDate(providerSubscription.ended_at) }
        : {}),
    };
    if (active && planMatches && paymentMatches) {
      update.status = 'ACTIVE';
      update.activatedAt = subscription.activatedAt ?? new Date();
    } else if (active && (!planMatches || payment.status.toLowerCase() === 'captured')) {
      update.status = 'PAST_DUE';
    } else if (providerSubscription.status === 'cancelled') {
      if (subscription.activatedAt === null) {
        update.status = 'PENDING_ACTIVATION';
      } else if (scheduledCancellation && periodEnd) {
        update.status = 'ACTIVE';
        update.expiresAt = periodEnd;
      } else {
        update.status = 'CANCELLED';
      }
    } else if (
      providerSubscription.status === 'completed' ||
      providerSubscription.status === 'expired'
    ) {
      update.status = 'EXPIRED';
    } else if (
      providerSubscription.status === 'halted' ||
      providerSubscription.status === 'paused' ||
      subscription.status === 'ACTIVE'
    ) {
      update.status = 'PAST_DUE';
    }
    await tx.businessSubscription.update({
      where: { id: subscription.id },
      data: update,
    });
  }

  private async applySubscriptionEvent(
    tx: Prisma.TransactionClient,
    eventType: string,
    providerSubscription: RazorpaySubscription,
  ): Promise<void> {
    const subscription = await tx.businessSubscription.findUnique({
      where: { razorpaySubscriptionId: providerSubscription.id },
    });
    if (!subscription) return;

    const { plan, billingCycle } = this.planFor(subscription);
    if (
      providerSubscription.plan_id !==
      configuredRazorpayPlanId(plan.id, billingCycle)
    ) {
      return;
    }

    const update: Prisma.BusinessSubscriptionUpdateInput = {
      providerStatus: providerSubscription.status,
      ...(typeof providerSubscription.cancel_at_cycle_end === 'boolean'
        ? { cancelAtPeriodEnd: providerSubscription.cancel_at_cycle_end }
        : {}),
      ...(unixDate(providerSubscription.current_start)
        ? { currentPeriodStart: unixDate(providerSubscription.current_start) }
        : {}),
      ...(unixDate(providerSubscription.current_end)
        ? { currentPeriodEnd: unixDate(providerSubscription.current_end) }
        : {}),
      ...(unixDate(providerSubscription.ended_at)
        ? { cancelledAt: unixDate(providerSubscription.ended_at) }
        : {}),
    };

    if (eventType === 'subscription.cancelled') {
      update.expiresAt =
        unixDate(providerSubscription.current_end) ??
        unixDate(providerSubscription.ended_at) ??
        new Date();
      const currentPeriodEnd = unixDate(providerSubscription.current_end);
      if (
        subscription.activatedAt === null &&
        (subscription.status === 'PENDING_ACTIVATION' ||
          subscription.status === 'PAST_DUE')
      ) {
        update.status = 'PENDING_ACTIVATION';
      } else if (
        providerSubscription.cancel_at_cycle_end &&
        currentPeriodEnd &&
        currentPeriodEnd.getTime() > Date.now()
      ) {
        update.status = 'ACTIVE';
        const cancellationTime = unixDate(providerSubscription.ended_at);
        if (cancellationTime) update.cancelledAt = cancellationTime;
      } else {
        update.status = 'CANCELLED';
        update.cancelledAt =
          unixDate(providerSubscription.ended_at) ?? new Date();
      }
    } else if (
      eventType === 'subscription.completed' ||
      eventType === 'subscription.expired'
    ) {
      update.status = 'EXPIRED';
      update.expiresAt =
        unixDate(providerSubscription.ended_at) ??
        unixDate(providerSubscription.current_end) ??
        new Date();
    } else if (
      eventType === 'subscription.halted' ||
      eventType === 'subscription.paused'
    ) {
      update.status = 'PAST_DUE';
    } else if (
      eventType === 'subscription.activated' ||
      eventType === 'subscription.resumed'
    ) {
      const capturedPayment = await tx.subscriptionPayment.findFirst({
        where: {
          subscriptionId: subscription.id,
          providerSubscriptionId: providerSubscription.id,
          status: 'CAPTURED',
          amountPaise: getSubscriptionPlan(
            subscription.planId,
            subscription.billingCycle,
          ).amountPaise,
          currency: 'INR',
        },
        select: { id: true },
      });
      if (capturedPayment) {
        update.status = 'ACTIVE';
        update.activatedAt = subscription.activatedAt ?? new Date();
      }
    }

    await tx.businessSubscription.update({
      where: { id: subscription.id },
      data: update,
    });
  }
}
