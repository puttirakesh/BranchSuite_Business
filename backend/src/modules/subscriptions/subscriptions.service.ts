import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { Prisma, type SubscriptionStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { evaluateSubscriptionAccess } from "../../common/subscription-access";
import { getSubscriptionPlan } from "./subscription-catalog";
import {
  configuredRazorpayPlanId,
  RAZORPAY_PROVIDER,
  type RazorpayProvider,
  type RazorpaySubscription,
} from "./razorpay.provider";

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

export interface CheckoutResponse {
  subscriptionId: string;
  razorpaySubscriptionId: string;
  checkoutUrl: string | null;
  keyId: string;
  plan: { id: string; name: string };
  billingCycle: string;
  amountPaise: number;
  currency: string;
  status: string;
  providerStatus: string | null;
  reused: boolean;
}

type SubscriptionRow = {
  id: string;
  tenantId: string;
  planId: string;
  billingCycle: string;
  status: SubscriptionStatus;
  razorpaySubscriptionId: string | null;
  providerStatus: string | null;
  providerCheckoutUrl: string | null;
  activatedAt: Date | null;
};

/**
 * Razorpay subscription webhook events documented at
 * https://razorpay.com/docs/webhooks/payloads/subscriptions/ plus the payment
 * events that carry the charge outcome. Anything else is stored and acknowledged
 * without changing access.
 */
const SUBSCRIPTION_EVENTS = new Set([
  "subscription.authenticated",
  "subscription.activated",
  "subscription.charged",
  "subscription.completed",
  "subscription.updated",
  "subscription.pending",
  "subscription.halted",
  "subscription.paused",
  "subscription.resumed",
  "subscription.cancelled",
  "subscription.expired",
]);
const PAYMENT_EVENTS = new Set([
  "payment.authorized",
  "payment.captured",
  "payment.failed",
]);

/**
 * Provider states that can never take a payment again: the subscription is
 * replaced. Every other state (created, authenticated, active, pending, ...) is
 * reused so repeated taps/refreshes never create a second subscription.
 */
const CHECKOUT_REPLACEABLE_PROVIDER_STATES = new Set([
  "cancelled",
  "expired",
  "completed",
  "halted",
]);
/** Local states from which the owner may (re)start a payment. */
const CHECKOUT_ALLOWED_STATES: SubscriptionStatus[] = [
  "PENDING_ACTIVATION",
  "PAST_DUE",
  "EXPIRED",
  "CANCELLED",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function unixDate(value: number | null | undefined): Date | undefined {
  return typeof value === "number" && value > 0
    ? new Date(value * 1000)
    : undefined;
}

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);
  /** Collapses concurrent checkout calls from one tenant in this process. */
  private readonly checkoutInFlight = new Map<string, Promise<CheckoutResponse>>();
  private readonly rateBuckets = new Map<string, number[]>();
  private readonly lastRefresh = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    @Inject(RAZORPAY_PROVIDER)
    private readonly razorpay: RazorpayProvider,
  ) {}

  assertOwner(owner: OwnerContext): void {
    if (!owner.roles.includes("BUSINESS_OWNER")) {
      throw new ForbiddenException(
        "Only the business owner can manage subscription payments.",
      );
    }
  }

  /** Small per-tenant sliding-window limiter for the billing endpoints. */
  private assertRate(tenantId: string, bucket: string, max: number): void {
    const key = `${bucket}:${tenantId}`;
    const now = Date.now();
    const recent = (this.rateBuckets.get(key) ?? []).filter(
      (time) => now - time < 60_000,
    );
    if (recent.length >= max) {
      throw new HttpException(
        "Too many billing requests. Please wait a minute and try again.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    recent.push(now);
    this.rateBuckets.set(key, recent);
  }

  async pendingCheckout(owner: OwnerContext) {
    await this.expireEndedSubscription(owner.tenantId);
    const subscription = await this.prisma.businessSubscription.findUnique({
      where: { tenantId: owner.tenantId },
      include: {
        payments: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });
    if (!subscription) {
      throw new NotFoundException("No business subscription was found.");
    }
    const { plan, billingCycle, amountPaise } = this.planFor(subscription);
    return {
      subscriptionId: subscription.id,
      plan: { id: plan.id, name: plan.name },
      billingCycle,
      amountPaise,
      currency: "INR",
      status: subscription.status,
      providerStatus: subscription.providerStatus,
      accessAllowed: evaluateSubscriptionAccess(subscription).allowed,
      activatedAt: subscription.activatedAt,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
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

  /**
   * Pulls the authoritative state from Razorpay (subscription + paid invoices)
   * and reconciles it. This lets activation complete even when a webhook is
   * delayed or cannot reach the server (for example during local development),
   * and is the only completion path for the hosted-checkout (non-JS) flow, where
   * the app never receives a checkout signature.
   */
  async refresh(owner: OwnerContext) {
    this.assertRate(owner.tenantId, "refresh", 30);
    const now = Date.now();
    const last = this.lastRefresh.get(owner.tenantId) ?? 0;
    if (now - last < 2_000) return this.pendingCheckout(owner);
    this.lastRefresh.set(owner.tenantId, now);

    const record = await this.prisma.businessSubscription.findUnique({
      where: { tenantId: owner.tenantId },
    });
    if (!record) throw new NotFoundException("No business subscription was found.");
    if (!record.razorpaySubscriptionId) return this.pendingCheckout(owner);

    const providerId = record.razorpaySubscriptionId;
    let remote: RazorpaySubscription;
    try {
      remote = await this.razorpay.getSubscription(providerId);
    } catch (error) {
      if (error instanceof NotFoundException) return this.pendingCheckout(owner);
      throw error;
    }
    const invoices = await this.razorpay.listSubscriptionInvoices(providerId);
    const payments: PaymentInput[] = [];
    for (const invoice of invoices) {
      if (
        invoice.status !== "paid" ||
        !invoice.payment_id ||
        invoice.subscription_id !== providerId
      ) {
        continue;
      }
      const payment = await this.razorpay.getPayment(invoice.payment_id);
      payments.push({
        id: payment.id,
        providerSubscriptionId: providerId,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        errorCode: payment.error_code,
        errorDescription: payment.error_description,
        createdAt: payment.created_at,
        capturedAt: payment.captured_at ?? undefined,
      });
    }
    await this.prisma.$transaction(async (tx) => {
      for (const payment of payments) {
        await this.savePayment(tx, { ...payment, subscriptionRecordId: record.id });
      }
      await this.reconcile(tx, record, remote);
    });
    return this.pendingCheckout(owner);
  }

  async createCheckout(owner: OwnerContext) {
    this.assertRate(owner.tenantId, "checkout", 12);
    const running = this.checkoutInFlight.get(owner.tenantId);
    if (running) return running;
    const task = this.runCheckout(owner).finally(() => {
      this.checkoutInFlight.delete(owner.tenantId);
    });
    this.checkoutInFlight.set(owner.tenantId, task);
    return task;
  }

  private async runCheckout(owner: OwnerContext): Promise<CheckoutResponse> {
    let createdProviderId: string | null = null;
    try {
      // The advisory lock serialises checkout across API instances; the
      // generous timeout covers the Razorpay round-trips made while holding it.
      return await this.prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`razorpay-checkout:${owner.tenantId}`})::bigint)`;

          const subscription = await tx.businessSubscription.findUnique({
            where: { tenantId: owner.tenantId },
          });
          if (!subscription) {
            throw new NotFoundException(
              "No pending business subscription was found.",
            );
          }
          if (!CHECKOUT_ALLOWED_STATES.includes(subscription.status)) {
            throw new ConflictException(
              "This subscription is already active and does not need payment.",
            );
          }

          const { plan, billingCycle, amountPaise } = this.planFor(subscription);
          const respond = (
            record: { id: string; status: string; providerStatus: string | null },
            razorpaySubscriptionId: string,
            checkoutUrl: string | null,
            reused: boolean,
          ) => ({
            subscriptionId: record.id,
            razorpaySubscriptionId,
            checkoutUrl,
            keyId: this.razorpay.publicKeyId(),
            plan: { id: plan.id, name: plan.name },
            billingCycle,
            amountPaise,
            currency: "INR",
            status: record.status,
            providerStatus: record.providerStatus,
            reused,
          });

          let hadPrevious = false;
          if (subscription.razorpaySubscriptionId) {
            hadPrevious = true;
            let remote: RazorpaySubscription | null = null;
            try {
              remote = await this.razorpay.getSubscription(
                subscription.razorpaySubscriptionId,
              );
            } catch (error) {
              // Only a definite "does not exist" may lead to a replacement. Any
              // other failure is uncertain: never create a second subscription.
              if (!(error instanceof NotFoundException)) throw error;
            }
            if (remote && !CHECKOUT_REPLACEABLE_PROVIDER_STATES.has(remote.status)) {
              if (remote.status === "paused") {
                throw new ConflictException(
                  "This subscription is paused at Razorpay. Contact support to resume it.",
                );
              }
              const checkoutUrl =
                remote.short_url ?? subscription.providerCheckoutUrl;
              await tx.businessSubscription.update({
                where: { id: subscription.id },
                data: {
                  providerStatus: remote.status,
                  providerCheckoutUrl: checkoutUrl,
                },
              });
              return respond(
                { ...subscription, providerStatus: remote.status },
                subscription.razorpaySubscriptionId,
                checkoutUrl,
                true,
              );
            }
          }

          const razorpaySubscription = await this.razorpay.createSubscription({
            planId: plan.id,
            billingCycle,
            tenantId: owner.tenantId,
            attempt: hadPrevious ? 1 : 0,
          });
          createdProviderId = razorpaySubscription.id;
          const updated = await tx.businessSubscription.update({
            where: { id: subscription.id },
            data: {
              razorpaySubscriptionId: razorpaySubscription.id,
              providerStatus: razorpaySubscription.status,
              providerCheckoutUrl: razorpaySubscription.short_url ?? null,
              cancelAtPeriodEnd: false,
              cancelledAt: null,
              expiresAt: null,
              currentPeriodStart: null,
              currentPeriodEnd: null,
            },
          });
          return respond(
            updated,
            razorpaySubscription.id,
            razorpaySubscription.short_url ?? null,
            false,
          );
        },
        { maxWait: 10_000, timeout: 45_000 },
      );
    } catch (error) {
      if (createdProviderId) {
        // The new provider subscription was never persisted: cancel it so it is
        // not left orphaned. Best effort; the next checkout self-heals anyway.
        await this.razorpay.cancelSubscription(createdProviderId).catch(() => {
          this.logger.warn("Could not cancel an unsaved Razorpay subscription.");
        });
      }
      throw error;
    }
  }

  async verifyCheckout(
    owner: OwnerContext,
    input: {
      razorpayPaymentId: string;
      razorpaySubscriptionId: string;
      razorpaySignature: string;
    },
  ) {
    this.assertRate(owner.tenantId, "verify", 20);
    if (
      !/^pay_[A-Za-z0-9]+$/.test(input.razorpayPaymentId) ||
      !/^sub_[A-Za-z0-9]+$/.test(input.razorpaySubscriptionId) ||
      !/^[a-fA-F0-9]{64}$/.test(input.razorpaySignature)
    ) {
      throw new BadRequestException("Invalid Razorpay checkout response.");
    }

    const record = await this.prisma.businessSubscription.findUnique({
      where: { tenantId: owner.tenantId },
    });
    // The subscription ID used for the signature is the one stored for THIS
    // tenant, never the value echoed by the client (Razorpay's own guidance).
    if (
      !record ||
      record.razorpaySubscriptionId !== input.razorpaySubscriptionId
    ) {
      throw new ForbiddenException(
        "The checkout subscription does not belong to this business account.",
      );
    }
    if (
      record.status !== "PENDING_ACTIVATION" &&
      record.status !== "PAST_DUE" &&
      record.status !== "EXPIRED" &&
      record.status !== "CANCELLED" &&
      record.status !== "ACTIVE"
    ) {
      throw new ConflictException(
        "This subscription is not awaiting payment verification.",
      );
    }

    this.verifyCheckoutSignature(
      input.razorpayPaymentId,
      record.razorpaySubscriptionId,
      input.razorpaySignature,
    );
    const [payment, razorpaySubscription] = await Promise.all([
      this.razorpay.getPayment(input.razorpayPaymentId),
      this.razorpay.getSubscription(record.razorpaySubscriptionId),
    ]);
    if (
      payment.id !== input.razorpayPaymentId ||
      razorpaySubscription.id !== record.razorpaySubscriptionId
    ) {
      throw new ForbiddenException(
        "Razorpay returned a payment or subscription that does not match this checkout.",
      );
    }

    // Razorpay payment entities have no subscription_id. The HMAC above already
    // binds this payment to this subscription (it can only be produced with our
    // key secret). As defence in depth, cross-check the payment's invoice when
    // Razorpay provides one, and reject any explicit mismatch.
    if (
      payment.subscription_id &&
      payment.subscription_id !== record.razorpaySubscriptionId
    ) {
      throw new ForbiddenException(
        "The Razorpay payment is linked to a different subscription.",
      );
    }
    if (payment.invoice_id) {
      const invoice = await this.razorpay.getInvoice(payment.invoice_id);
      if (
        invoice.subscription_id &&
        invoice.subscription_id !== record.razorpaySubscriptionId
      ) {
        throw new ForbiddenException(
          "The Razorpay payment is linked to a different subscription.",
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await this.savePayment(tx, {
        id: payment.id,
        subscriptionRecordId: record.id,
        providerSubscriptionId: record.razorpaySubscriptionId as string,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        errorCode: payment.error_code,
        errorDescription: payment.error_description,
        createdAt: payment.created_at,
        capturedAt: payment.captured_at ?? undefined,
      });
      await this.reconcile(tx, record, razorpaySubscription);
    });

    const updated = await this.prisma.businessSubscription.findUnique({
      where: { id: record.id },
      select: { status: true, providerStatus: true, activatedAt: true },
    });
    return {
      verified: true,
      activated: updated?.status === "ACTIVE",
      status: updated?.status ?? record.status,
      providerStatus: updated?.providerStatus ?? razorpaySubscription.status,
      activatedAt: updated?.activatedAt ?? null,
      message:
        updated?.status === "ACTIVE"
          ? "Payment confirmed and subscription activated."
          : "Checkout was verified, but a captured initial payment has not yet been confirmed.",
    };
  }

  async processWebhook(
    rawBody: Buffer | undefined,
    signature: string | undefined,
    eventIdHeader: string | undefined,
  ) {
    if (!rawBody?.length || !signature) {
      throw new BadRequestException(
        "A raw webhook body and signature are required.",
      );
    }
    if (eventIdHeader && !/^[A-Za-z0-9._-]{1,120}$/.test(eventIdHeader)) {
      throw new BadRequestException("Invalid webhook event ID.");
    }
    this.verifyWebhookSignature(rawBody, signature);
    // Razorpay sends X-Razorpay-Event-Id. If it is ever absent, fall back to a
    // digest of the signed body so identical deliveries are still deduplicated.
    const eventId =
      eventIdHeader ??
      `body-${createHash("sha256").update(rawBody).digest("hex").slice(0, 40)}`;

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody.toString("utf8")) as unknown;
    } catch {
      throw new BadRequestException("Invalid Razorpay webhook JSON.");
    }
    if (!isRecord(payload) || typeof payload.event !== "string") {
      throw new BadRequestException("Invalid Razorpay webhook event.");
    }

    const eventType = payload.event;
    const data = isRecord(payload.payload) ? payload.payload : {};
    const paymentEntity = this.entity(data.payment);
    const subscriptionEntity = this.entity(data.subscription);
    const known =
      SUBSCRIPTION_EVENTS.has(eventType) || PAYMENT_EVENTS.has(eventType);

    // Resolve which provider subscription (if any) this event belongs to.
    let providerSubscriptionId = subscriptionEntity
      ? stringValue(subscriptionEntity.id)
      : undefined;
    if (known && !providerSubscriptionId && paymentEntity) {
      providerSubscriptionId = stringValue(paymentEntity.subscription_id);
      const invoiceId = stringValue(paymentEntity.invoice_id);
      if (!providerSubscriptionId && invoiceId) {
        // Payment entities link to a subscription through their invoice.
        providerSubscriptionId = (await this.razorpay.getInvoice(invoiceId))
          .subscription_id ?? undefined;
      }
    }

    const record = providerSubscriptionId
      ? await this.prisma.businessSubscription.findUnique({
          where: { razorpaySubscriptionId: providerSubscriptionId },
        })
      : null;

    // Decisions are made from Razorpay's CURRENT subscription state, fetched
    // here, rather than from the (possibly stale or re-ordered) event body. A
    // late `subscription.pending` can therefore never undo a newer `active`.
    let remote: RazorpaySubscription | null = null;
    if (known && record && providerSubscriptionId) {
      remote = await this.razorpay.getSubscription(providerSubscriptionId);
    }
    const payment =
      known && record && paymentEntity && providerSubscriptionId
        ? this.paymentInput(paymentEntity, providerSubscriptionId)
        : null;

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.razorpayWebhookEvent.create({
          data: {
            providerEventId: eventId,
            eventType,
            payload: payload as Prisma.InputJsonValue,
          },
        });

        if (record && remote) {
          if (
            payment &&
            (PAYMENT_EVENTS.has(eventType) ||
              eventType === "subscription.charged")
          ) {
            await this.savePayment(tx, {
              ...payment,
              subscriptionRecordId: record.id,
              status:
                eventType === "payment.failed"
                  ? "failed"
                  : eventType === "payment.authorized"
                    ? "authorized"
                    : payment.status,
            });
          }
          // Re-read inside the transaction so concurrent deliveries serialise
          // on current local state.
          const current = await tx.businessSubscription.findUnique({
            where: { id: record.id },
          });
          if (current) await this.reconcile(tx, current, remote);
        }

        await tx.razorpayWebhookEvent.update({
          where: { providerEventId: eventId },
          data: { processedAt: new Date(), lastError: null },
        });
      });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
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

  private planFor(subscription: { planId: string; billingCycle: string }) {
    try {
      return getSubscriptionPlan(
        subscription.planId,
        subscription.billingCycle,
      );
    } catch {
      throw new ConflictException(
        "The saved subscription plan is invalid. Payment cannot be initiated.",
      );
    }
  }

  private async expireEndedSubscription(tenantId: string): Promise<void> {
    const now = new Date();
    await this.prisma.businessSubscription.updateMany({
      where: {
        tenantId,
        status: "ACTIVE",
        OR: [{ expiresAt: { lte: now } }, { currentPeriodEnd: { lte: now } }],
      },
      data: { status: "EXPIRED" },
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
        "Razorpay API credentials are not configured.",
      );
    }
    // Subscription checkout signature: HMAC-SHA256(payment_id + "|" + subscription_id).
    const expected = createHmac("sha256", secret)
      .update(`${paymentId}|${subscriptionId}`)
      .digest();
    const actual = Buffer.from(provided, "hex");
    if (
      actual.length !== expected.length ||
      !timingSafeEqual(expected, actual)
    ) {
      throw new ForbiddenException("Razorpay checkout signature is invalid.");
    }
  }

  private verifyWebhookSignature(rawBody: Buffer, provided: string): void {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
    if (!secret) {
      throw new ServiceUnavailableException(
        "Razorpay webhook secret is not configured.",
      );
    }
    if (!/^[a-fA-F0-9]{64}$/.test(provided)) {
      throw new ForbiddenException("Razorpay webhook signature is invalid.");
    }
    const expected = createHmac("sha256", secret).update(rawBody).digest();
    const actual = Buffer.from(provided, "hex");
    if (
      actual.length !== expected.length ||
      !timingSafeEqual(expected, actual)
    ) {
      throw new ForbiddenException("Razorpay webhook signature is invalid.");
    }
  }

  private entity(value: unknown): Record<string, unknown> | null {
    if (!isRecord(value) || !isRecord(value.entity)) return null;
    return value.entity;
  }

  private paymentInput(
    entity: Record<string, unknown>,
    providerSubscriptionId: string,
  ): PaymentInput | null {
    const id = stringValue(entity.id);
    const amount = numberValue(entity.amount);
    const currency = stringValue(entity.currency);
    const status = stringValue(entity.status);
    if (!id || amount === undefined || !currency || !status) return null;
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

  private async savePayment(
    tx: Prisma.TransactionClient,
    payment: PaymentInput & { subscriptionRecordId: string },
  ): Promise<void> {
    const existing = await tx.subscriptionPayment.findUnique({
      where: { providerPaymentId: payment.id },
      select: { status: true },
    });
    const incoming = payment.status.toLowerCase();
    // A captured payment is never downgraded by a late or replayed event; a
    // refund is the only legitimate change after capture.
    if (
      existing?.status === "CAPTURED" &&
      incoming !== "captured" &&
      incoming !== "refunded"
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
          status === "CAPTURED"
            ? (unixDate(payment.capturedAt) ??
              unixDate(payment.createdAt) ??
              new Date())
            : null,
      },
      update: {
        amountPaise: payment.amount,
        currency: payment.currency,
        status,
        failureCode: payment.errorCode ?? null,
        failureDescription: payment.errorDescription ?? null,
        ...(status === "CAPTURED"
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

  /**
   * Single place that maps Razorpay's CURRENT subscription state (plus our
   * recorded payments) onto the local access status.
   *
   * Policy: paid access (ACTIVE) requires BOTH an `active` subscription at
   * Razorpay AND a captured payment of the exact plan amount in INR recorded for
   * this subscription. `authenticated` alone (a mandate with no charge) never
   * grants access.
   */
  private async reconcile(
    tx: Prisma.TransactionClient,
    subscription: SubscriptionRow,
    remote: RazorpaySubscription,
  ): Promise<void> {
    // An event for a replaced/foreign subscription must not alter this tenant.
    if (remote.id !== subscription.razorpaySubscriptionId) return;
    const { plan, billingCycle, amountPaise } = this.planFor(subscription);
    if (remote.plan_id !== configuredRazorpayPlanId(plan.id, billingCycle)) {
      this.logger.warn("Ignoring Razorpay state with an unexpected plan.");
      return;
    }

    const periodEnd = unixDate(remote.current_end);
    const update: Prisma.BusinessSubscriptionUpdateInput = {
      providerStatus: remote.status,
      ...(typeof remote.cancel_at_cycle_end === "boolean"
        ? { cancelAtPeriodEnd: remote.cancel_at_cycle_end }
        : {}),
      ...(unixDate(remote.current_start)
        ? { currentPeriodStart: unixDate(remote.current_start) }
        : {}),
      ...(periodEnd ? { currentPeriodEnd: periodEnd } : {}),
    };

    switch (remote.status) {
      case "active": {
        const captured = await tx.subscriptionPayment.findFirst({
          where: {
            subscriptionId: subscription.id,
            providerSubscriptionId: remote.id,
            status: "CAPTURED",
            amountPaise,
            currency: "INR",
          },
          select: { id: true },
        });
        if (captured) {
          update.status = "ACTIVE";
          update.activatedAt = subscription.activatedAt ?? new Date();
          update.expiresAt = null;
          update.cancelledAt = null;
        }
        break;
      }
      case "pending":
        // A failed renewal. Before the first paid cycle this is just a failed
        // authorisation, so the tenant simply remains awaiting payment.
        if (subscription.activatedAt) update.status = "PAST_DUE";
        break;
      case "halted":
      case "paused":
        update.status = subscription.activatedAt
          ? "PAST_DUE"
          : "PENDING_ACTIVATION";
        break;
      case "cancelled": {
        const endedAt = unixDate(remote.ended_at);
        if (!subscription.activatedAt) {
          update.status = "PENDING_ACTIVATION";
        } else if (
          remote.cancel_at_cycle_end === true &&
          periodEnd &&
          periodEnd.getTime() > Date.now()
        ) {
          // Cancelled at cycle end: paid access continues until the period ends.
          update.status = "ACTIVE";
          update.expiresAt = periodEnd;
          if (endedAt) update.cancelledAt = endedAt;
        } else {
          update.status = "CANCELLED";
          update.cancelledAt = endedAt ?? new Date();
          update.expiresAt = periodEnd ?? endedAt ?? new Date();
        }
        break;
      }
      case "completed":
      case "expired":
        if (subscription.activatedAt) {
          update.status = "EXPIRED";
          update.expiresAt =
            unixDate(remote.ended_at) ?? periodEnd ?? new Date();
        } else {
          // Never paid (e.g. the checkout link expired): remains awaiting
          // payment so a fresh checkout can be created.
          update.status = "PENDING_ACTIVATION";
        }
        break;
      default:
        // created / authenticated / unknown: record the provider status only.
        break;
    }

    await tx.businessSubscription.update({
      where: { id: subscription.id },
      data: update,
    });
  }
}
