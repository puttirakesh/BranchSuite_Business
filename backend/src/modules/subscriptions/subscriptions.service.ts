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
import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { Prisma, type SubscriptionOrder } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { evaluateSubscriptionAccess } from "../../common/subscription-access";
import {
  addCalendarMonths,
  computeValidity,
  cycleMonths,
  daysRemaining,
  effectiveExpiry,
} from "../../common/subscription-dates";
import { getSubscriptionPlan } from "./subscription-catalog";
import {
  RAZORPAY_PROVIDER,
  type RazorpayPayment,
  type RazorpayProvider,
} from "./razorpay.provider";

/**
 * Prepaid billing with manual renewal (Razorpay Orders API, one-time Standard
 * Checkout). There are NO recurring mandates, NO automatic charges and NO trial.
 *
 * Invariants
 *  - Amounts/plans are derived server-side from the catalog; clients cannot
 *    choose an amount or a tenant.
 *  - Access starts ONLY from a payment that Razorpay reports as `captured`, for
 *    the exact order/amount/currency we stored for that tenant.
 *  - One captured payment extends validity exactly once (atomic claim of the
 *    order row under a per-tenant advisory lock).
 *  - Legacy recurring records (`sub_...`) are preserved and never activate or
 *    extend anything: their events are stored and ignored.
 */

type OwnerContext = { id: string; tenantId: string; roles: string[] };

export interface CheckoutOrder {
  orderId: string; // internal id
  razorpayOrderId: string;
  keyId: string;
  amount: number; // paise, from the server catalog
  currency: "INR";
  planId: string;
  planName: string;
  billingCycle: string;
  purpose: "ACTIVATION" | "RENEWAL";
  reused: boolean;
  /** Hosted checkout for native apps (no SDK needed). */
  hostedCheckoutUrl: string;
}

export type SettleState =
  | "APPLIED"
  | "ALREADY_APPLIED"
  | "PENDING"
  | "FAILED"
  | "REJECTED";

export interface SettleOutcome {
  state: SettleState;
  message: string;
}

const PAYMENT_EVENTS = new Set([
  "payment.authorized",
  "payment.captured",
  "payment.failed",
  "order.paid",
]);

/** A created-but-unpaid order older than this is not reused. */
const ORDER_REUSE_WINDOW_MS = 24 * 60 * 60 * 1000;
const CHECKOUT_TOKEN_TTL_MS = 30 * 60 * 1000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
function unixDate(value: number | null | undefined): Date | undefined {
  return typeof value === "number" && value > 0
    ? new Date(value * 1000)
    : undefined;
}
function safeEqualHex(expected: Buffer, provided: string): boolean {
  if (!/^[a-fA-F0-9]+$/.test(provided) || provided.length !== expected.length * 2) {
    return false;
  }
  return timingSafeEqual(expected, Buffer.from(provided, "hex"));
}

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);
  /** Collapses concurrent order creation from one tenant in this process. */
  private readonly orderInFlight = new Map<string, Promise<CheckoutOrder>>();
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

  private planFor(subscription: { planId: string; billingCycle: string }) {
    try {
      return getSubscriptionPlan(subscription.planId, subscription.billingCycle);
    } catch {
      throw new ConflictException(
        "The saved subscription plan is invalid. Payment cannot be initiated.",
      );
    }
  }

  // ------------------------------------------------------------------ reads --

  /** Lazily marks an ended ACTIVE subscription EXPIRED (display only: the guards
   *  independently deny access by comparing the timestamps). */
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

  async status(owner: OwnerContext) {
    await this.expireEndedSubscription(owner.tenantId);
    const subscription = await this.prisma.businessSubscription.findUnique({
      where: { tenantId: owner.tenantId },
      include: {
        payments: { orderBy: { createdAt: "desc" }, take: 20 },
        orders: {
          where: { status: "CREATED" },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });
    if (!subscription) {
      throw new NotFoundException("No business subscription was found.");
    }
    const { plan, billingCycle, amountPaise } = this.planFor(subscription);
    const now = new Date();
    const expiry = effectiveExpiry(subscription);
    const access = evaluateSubscriptionAccess(subscription, now.getTime());
    const renewal = this.renewalEligibility(subscription, billingCycle, now);
    const openOrder = subscription.orders[0] ?? null;
    return {
      subscriptionId: subscription.id,
      plan: { id: plan.id, name: plan.name },
      billingCycle,
      amountPaise,
      currency: "INR" as const,
      status: subscription.status,
      accessAllowed: access.allowed,
      billingModel: subscription.billingModel,
      purpose: subscription.activatedAt ? ("RENEWAL" as const) : ("ACTIVATION" as const),
      activatedAt: subscription.activatedAt,
      currentPeriodStart: subscription.currentPeriodStart,
      expiresAt: expiry,
      daysRemaining: access.allowed ? daysRemaining(expiry, now) : 0,
      lastPaymentAt: subscription.lastPaymentAt,
      canPay: renewal.allowed,
      payBlockedReason: renewal.reason,
      openOrder: openOrder
        ? {
            orderId: openOrder.id,
            razorpayOrderId: openOrder.razorpayOrderId,
            purpose: openOrder.purpose,
            amountPaise: openOrder.amountPaise,
            createdAt: openOrder.createdAt,
          }
        : null,
      // A recurring Razorpay subscription from the previous architecture exists.
      // It is kept for history only and is never used for new purchases.
      hasLegacyRecurringSubscription: !!subscription.razorpaySubscriptionId,
      paymentHistory: subscription.payments.map((payment) => ({
        id: payment.id,
        providerPaymentId: payment.providerPaymentId,
        providerOrderId: payment.providerOrderId,
        amountPaise: payment.amountPaise,
        currency: payment.currency,
        status: payment.status,
        method: payment.method,
        failureCode: payment.failureCode,
        failureDescription: payment.failureDescription,
        capturedAt: payment.capturedAt,
        createdAt: payment.createdAt,
      })),
    };
  }

  pendingCheckout(owner: OwnerContext) {
    return this.status(owner);
  }

  /**
   * May the owner start a payment now?
   * Early renewal is allowed only inside the final cycle of paid time, so
   * validity can never be stacked more than one cycle ahead.
   */
  private renewalEligibility(
    subscription: {
      status: string;
      expiresAt: Date | null;
      currentPeriodEnd: Date | null;
    },
    billingCycle: string,
    now: Date,
  ): { allowed: boolean; reason: string | null } {
    const expiry = effectiveExpiry(subscription);
    if (
      subscription.status === "ACTIVE" &&
      expiry &&
      expiry.getTime() > now.getTime()
    ) {
      const horizon = addCalendarMonths(
        now,
        cycleMonths(billingCycle as "monthly" | "annual"),
      );
      if (expiry.getTime() > horizon.getTime()) {
        return {
          allowed: false,
          reason:
            "Your plan is already paid beyond the next renewal window. You can renew again closer to the expiry date.",
        };
      }
    }
    return { allowed: true, reason: null };
  }

  // ----------------------------------------------------------------- orders --

  async createOrder(
    owner: OwnerContext,
    requested: { planId?: string; billingCycle?: string },
    publicBaseUrl: string,
  ): Promise<CheckoutOrder> {
    this.assertRate(owner.tenantId, "order", 12);
    const running = this.orderInFlight.get(owner.tenantId);
    if (running) return running;
    const task = this.runCreateOrder(owner, requested, publicBaseUrl).finally(
      () => {
        this.orderInFlight.delete(owner.tenantId);
      },
    );
    this.orderInFlight.set(owner.tenantId, task);
    return task;
  }

  private async runCreateOrder(
    owner: OwnerContext,
    requested: { planId?: string; billingCycle?: string },
    publicBaseUrl: string,
  ): Promise<CheckoutOrder> {
    // Settle any already-paid-but-unapplied order first (missed webhook / closed
    // tab) so we never ask the owner to pay twice for the same period.
    await this.reconcileOpenOrders(owner.tenantId).catch(() => undefined);

    // Provider calls happen while holding the per-tenant lock so concurrent
    // requests collapse to one order. An unpaid Razorpay order that is never
    // saved is harmless (no money moves, it simply stays unused).
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`subscription-billing:${owner.tenantId}`})::bigint)`;
        const subscription = await tx.businessSubscription.findUnique({
          where: { tenantId: owner.tenantId },
        });
        if (!subscription) {
          throw new NotFoundException("No business subscription was found.");
        }

        const firstPayment = !subscription.activatedAt;
        let planId = subscription.planId;
        let billingCycle = subscription.billingCycle;
        const wantsPlan = requested.planId ?? planId;
        const wantsCycle = requested.billingCycle ?? billingCycle;
        if (wantsPlan !== planId || wantsCycle !== billingCycle) {
          if (!firstPayment) {
            // Plan/cycle changes after a purchase would need proration rules the
            // product has not defined: refuse rather than bill ambiguously.
            throw new ConflictException(
              "Changing plan or billing cycle is not supported yet. Renew your current plan, or contact support to change it.",
            );
          }
          // Before the first payment nothing was bought, so the choice may change.
          try {
            getSubscriptionPlan(wantsPlan, wantsCycle);
          } catch {
            throw new BadRequestException("Invalid plan or billing cycle.");
          }
          planId = wantsPlan;
          billingCycle = wantsCycle;
        }

        // planFor turns a corrupt stored plan into a clean 409 instead of a 500.
        const { plan, amountPaise } = this.planFor({ planId, billingCycle });
        const now = new Date();
        const renewal = this.renewalEligibility(
          subscription,
          billingCycle,
          now,
        );
        if (!renewal.allowed) {
          throw new ConflictException(renewal.reason ?? "Payment is not needed.");
        }
        const purpose = firstPayment ? "ACTIVATION" : "RENEWAL";

        const respond = (order: SubscriptionOrder, reused: boolean): CheckoutOrder => ({
          orderId: order.id,
          razorpayOrderId: order.razorpayOrderId,
          keyId: this.razorpay.publicKeyId(),
          amount: order.amountPaise,
          currency: "INR",
          planId: order.planId,
          planName: plan.name,
          billingCycle: order.billingCycle,
          purpose: order.purpose as "ACTIVATION" | "RENEWAL",
          reused,
          hostedCheckoutUrl: this.hostedCheckoutUrl(publicBaseUrl, order),
        });

        // Reuse a still-valid unpaid order for exactly this purchase.
        const open = await tx.subscriptionOrder.findFirst({
          where: { tenantId: owner.tenantId, status: "CREATED" },
          orderBy: { createdAt: "desc" },
        });
        if (open) {
          const fresh = now.getTime() - open.createdAt.getTime() < ORDER_REUSE_WINDOW_MS;
          const same =
            open.planId === planId &&
            open.billingCycle === billingCycle &&
            open.amountPaise === amountPaise &&
            open.purpose === purpose;
          let providerStatus: string | null = null;
          if (fresh && same) {
            try {
              providerStatus = (await this.razorpay.getOrder(open.razorpayOrderId)).status;
            } catch (error) {
              // Only a definite "does not exist" may lead to a replacement.
              if (!(error instanceof NotFoundException)) throw error;
            }
          }
          if (fresh && same && (providerStatus === "created" || providerStatus === "attempted")) {
            return respond(open, true);
          }
          // Stale, different, missing or already paid at Razorpay: retire it.
          await tx.subscriptionOrder.updateMany({
            where: { id: open.id, status: "CREATED" },
            data: {
              status: "CANCELLED",
              failureDescription:
                providerStatus === "paid"
                  ? "Order paid at Razorpay; awaiting reconciliation."
                  : "Superseded by a newer checkout.",
            },
          });
          if (providerStatus === "paid") {
            throw new ConflictException(
              "A payment for this order was received and is being confirmed. Refresh your status in a moment.",
            );
          }
        }

        const id = randomUUID();
        const providerOrder = await this.razorpay.createOrder({
          amountPaise,
          currency: "INR",
          receipt: `bs_${id.replace(/-/g, "").slice(0, 30)}`,
          notes: {
            order_ref: id,
            tenant_id: owner.tenantId,
            plan_id: planId,
            billing_cycle: billingCycle,
            purpose,
          },
        });
        const order = await tx.subscriptionOrder.create({
          data: {
            id,
            tenantId: owner.tenantId,
            subscriptionId: subscription.id,
            purpose,
            planId,
            billingCycle,
            amountPaise,
            currency: "INR",
            razorpayOrderId: providerOrder.id,
            status: "CREATED",
          },
        });
        if (firstPayment) {
          // Record the (possibly changed) pre-payment choice and the billing model.
          await tx.businessSubscription.update({
            where: { id: subscription.id },
            data: { planId, billingCycle, billingModel: "PREPAID" },
          });
        }
        return respond(order, false);
      },
      { maxWait: 10_000, timeout: 45_000 },
    );
  }

  // ---------------------------------------------------------- verification --

  /** Constant-time check of Razorpay's Orders checkout signature. */
  verifyOrderSignature(
    razorpayOrderId: string,
    paymentId: string,
    provided: string,
  ): boolean {
    const secret = process.env.RAZORPAY_KEY_SECRET?.trim();
    if (!secret) {
      throw new ServiceUnavailableException(
        "Razorpay API credentials are not configured.",
      );
    }
    // Orders: HMAC-SHA256(order_id + "|" + payment_id). (Not the recurring
    // subscription format, which is payment_id|subscription_id.)
    const expected = createHmac("sha256", secret)
      .update(`${razorpayOrderId}|${paymentId}`)
      .digest();
    return safeEqualHex(expected, provided);
  }

  async verifyPayment(
    owner: OwnerContext,
    input: {
      razorpayOrderId: string;
      razorpayPaymentId: string;
      razorpaySignature: string;
    },
  ) {
    this.assertRate(owner.tenantId, "verify", 20);
    const order = await this.ownedOrder(owner.tenantId, input.razorpayOrderId);
    const outcome = await this.verifyAndSettle(order, input);
    return { ...outcome, ...(await this.accessSummary(owner.tenantId)) };
  }

  /** Verify path shared by the app (JWT) and the hosted checkout (signed token). */
  private async verifyAndSettle(
    order: SubscriptionOrder,
    input: {
      razorpayOrderId: string;
      razorpayPaymentId: string;
      razorpaySignature: string;
    },
  ): Promise<SettleOutcome & { verified: true }> {
    // The order ID used for the signature is OUR stored one, never the client's.
    if (
      !this.verifyOrderSignature(
        order.razorpayOrderId,
        input.razorpayPaymentId,
        input.razorpaySignature,
      )
    ) {
      throw new ForbiddenException("Razorpay payment signature is invalid.");
    }
    const outcome = await this.settlePayment(order, input.razorpayPaymentId);
    return { ...outcome, verified: true };
  }

  private async ownedOrder(
    tenantId: string,
    razorpayOrderId: string,
  ): Promise<SubscriptionOrder> {
    const order = await this.prisma.subscriptionOrder.findUnique({
      where: { razorpayOrderId },
    });
    // Same response for "unknown" and "someone else's": no tenant probing.
    if (!order || order.tenantId !== tenantId) {
      throw new ForbiddenException(
        "This payment does not belong to this business account.",
      );
    }
    return order;
  }

  private async accessSummary(tenantId: string) {
    const record = await this.prisma.businessSubscription.findUnique({
      where: { tenantId },
      select: {
        status: true,
        planId: true,
        expiresAt: true,
        currentPeriodEnd: true,
        billingModel: true,
      },
    });
    const decision = evaluateSubscriptionAccess(record);
    return {
      activated: decision.allowed,
      status: record?.status ?? "MISSING",
      expiresAt: record ? effectiveExpiry(record) : null,
    };
  }

  /**
   * Fetches the payment from Razorpay (authoritative), validates it against our
   * stored order and, if (and only if) it is captured, applies it exactly once.
   * An `authorized` payment is captured server-side first (Razorpay Dashboard
   * capture setting may be manual); capture is only requested for the exact
   * amount we stored, and Razorpay itself rejects a second capture.
   */
  async settlePayment(
    order: SubscriptionOrder,
    paymentId: string,
  ): Promise<SettleOutcome> {
    let payment = await this.razorpay.getPayment(paymentId);
    if (payment.order_id !== order.razorpayOrderId) {
      throw new ForbiddenException(
        "The payment does not belong to this order.",
      );
    }
    if (
      payment.amount !== order.amountPaise ||
      payment.currency !== order.currency
    ) {
      await this.savePayment(this.prisma, order, payment, {
        failureCode: "AMOUNT_MISMATCH",
        failureDescription: "Paid amount or currency differs from the order.",
        status: "REJECTED",
      });
      return {
        state: "REJECTED",
        message: "The paid amount does not match the order. Access was not granted.",
      };
    }

    if (payment.status === "authorized") {
      try {
        payment = await this.razorpay.capturePayment(
          payment.id,
          order.amountPaise,
          "INR",
        );
      } catch (error) {
        if (!(error instanceof NotFoundException)) {
          this.logger.warn("Capture request failed; re-reading payment state.");
        }
      }
      if (payment.status !== "captured") {
        payment = await this.razorpay.getPayment(paymentId);
      }
      if (
        payment.order_id !== order.razorpayOrderId ||
        payment.amount !== order.amountPaise
      ) {
        throw new ForbiddenException("The payment does not match this order.");
      }
    }

    if (payment.status === "captured") {
      return this.applyCapturedPayment(order, payment);
    }
    if (payment.status === "failed") {
      await this.savePayment(this.prisma, order, payment);
      await this.prisma.subscriptionOrder.updateMany({
        where: { id: order.id, status: "CREATED" },
        data: {
          failureCode: payment.error_code ?? "PAYMENT_FAILED",
          failureDescription: payment.error_description ?? "The payment failed.",
        },
      });
      return {
        state: "FAILED",
        message: payment.error_description || "The payment failed. You can try again.",
      };
    }
    await this.savePayment(this.prisma, order, payment);
    return {
      state: "PENDING",
      message: "The payment has not been captured yet.",
    };
  }

  /**
   * The only place access is granted. Runs in one transaction under a per-tenant
   * advisory lock; the order row is CLAIMED with a conditional update, so even
   * simultaneous callback + webhook + refresh extend validity once.
   */
  private async applyCapturedPayment(
    order: SubscriptionOrder,
    payment: RazorpayPayment,
  ): Promise<SettleOutcome> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`subscription-billing:${order.tenantId}`})::bigint)`;
      const fresh = await tx.subscriptionOrder.findUnique({
        where: { id: order.id },
      });
      if (!fresh) throw new NotFoundException("Order not found.");

      if (fresh.status === "PAID") {
        if (fresh.razorpayPaymentId === payment.id) {
          await this.savePayment(tx, fresh, payment);
          return { state: "ALREADY_APPLIED", message: "Payment already applied." };
        }
        // A second captured payment for an already-paid order: keep the record
        // for support/refund, never extend again.
        await this.savePayment(tx, fresh, payment, {
          failureCode: "DUPLICATE_PAYMENT",
          failureDescription:
            "A second payment was captured for an already paid order. Refund required.",
        });
        return {
          state: "ALREADY_APPLIED",
          message: "This order was already paid. The extra payment needs a refund.",
        };
      }

      const subscription = await tx.businessSubscription.findUnique({
        where: { id: fresh.subscriptionId },
      });
      if (!subscription) throw new NotFoundException("Subscription not found.");

      const now = new Date();
      const { validFrom, validUntil } = computeValidity({
        now,
        cycle: fresh.billingCycle as "monthly" | "annual",
        currentStatus: subscription.status,
        currentExpiry: effectiveExpiry(subscription),
      });
      const claimed = await tx.subscriptionOrder.updateMany({
        where: { id: fresh.id, status: { not: "PAID" } },
        data: {
          status: "PAID",
          razorpayPaymentId: payment.id,
          validFrom,
          validUntil,
          appliedAt: now,
          failureCode: null,
          failureDescription: null,
        },
      });
      if (claimed.count !== 1) {
        return { state: "ALREADY_APPLIED", message: "Payment already applied." };
      }
      await this.savePayment(tx, fresh, payment);
      await tx.businessSubscription.update({
        where: { id: subscription.id },
        data: {
          status: "ACTIVE",
          planId: fresh.planId,
          billingCycle: fresh.billingCycle,
          billingModel: "PREPAID",
          activatedAt: subscription.activatedAt ?? now,
          currentPeriodStart: validFrom,
          currentPeriodEnd: validUntil,
          expiresAt: validUntil,
          lastPaymentAt: now,
          cancelAtPeriodEnd: false,
          cancelledAt: null,
        },
      });
      return {
        state: "APPLIED",
        message:
          fresh.purpose === "RENEWAL"
            ? "Renewal confirmed."
            : "Payment confirmed and your plan is active.",
      };
    });
  }

  private async savePayment(
    db: Pick<Prisma.TransactionClient, "subscriptionPayment">,
    order: SubscriptionOrder,
    payment: RazorpayPayment,
    override: {
      status?: string;
      failureCode?: string;
      failureDescription?: string;
    } = {},
  ): Promise<void> {
    const existing = await db.subscriptionPayment.findUnique({
      where: { providerPaymentId: payment.id },
      select: { status: true },
    });
    const incoming = (override.status ?? payment.status).toLowerCase();
    // A captured payment is never downgraded by a late or replayed event; a
    // refund is the only legitimate change after capture.
    if (
      existing?.status === "CAPTURED" &&
      incoming !== "captured" &&
      incoming !== "refunded"
    ) {
      return;
    }
    const status = incoming.toUpperCase();
    const capturedAt = status === "CAPTURED" ? (unixDate(payment.created_at) ?? new Date()) : null;
    const data = {
      amountPaise: payment.amount,
      currency: payment.currency,
      status,
      method: payment.method ?? null,
      failureCode: override.failureCode ?? payment.error_code ?? null,
      failureDescription:
        override.failureDescription ?? payment.error_description ?? null,
    };
    await db.subscriptionPayment.upsert({
      where: { providerPaymentId: payment.id },
      create: {
        subscriptionId: order.subscriptionId,
        providerPaymentId: payment.id,
        orderId: order.id,
        providerOrderId: order.razorpayOrderId,
        capturedAt,
        ...data,
      },
      update: { ...data, ...(capturedAt ? { capturedAt } : {}) },
    });
  }

  // -------------------------------------------------------------- reconcile --

  /** Re-reads every unpaid order of the tenant from Razorpay and applies paid ones. */
  private async reconcileOpenOrders(tenantId: string): Promise<void> {
    const open = await this.prisma.subscriptionOrder.findMany({
      where: { tenantId, status: "CREATED" },
      orderBy: { createdAt: "desc" },
      take: 3,
    });
    for (const order of open) await this.reconcileOrder(order);
  }

  private async reconcileOrder(order: SubscriptionOrder): Promise<SettleOutcome> {
    let payments: RazorpayPayment[];
    try {
      payments = await this.razorpay.listOrderPayments(order.razorpayOrderId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        return { state: "PENDING", message: "Order not found at Razorpay." };
      }
      throw error;
    }
    let last: SettleOutcome = { state: "PENDING", message: "No payment yet." };
    // Captured first, then authorized (captured server-side), then the rest.
    const rank = (payment: RazorpayPayment) =>
      payment.status === "captured" ? 0 : payment.status === "authorized" ? 1 : 2;
    for (const payment of [...payments].sort((a, b) => rank(a) - rank(b))) {
      if (payment.order_id !== order.razorpayOrderId) continue;
      last = await this.settlePayment(order, payment.id);
      if (last.state === "APPLIED" || last.state === "ALREADY_APPLIED") break;
    }
    return last;
  }

  /** Owner-triggered, webhook-independent reconciliation with Razorpay. */
  async refresh(owner: OwnerContext) {
    this.assertRate(owner.tenantId, "refresh", 30);
    const now = Date.now();
    const last = this.lastRefresh.get(owner.tenantId) ?? 0;
    if (now - last >= 2_000) {
      this.lastRefresh.set(owner.tenantId, now);
      await this.reconcileOpenOrders(owner.tenantId);
    }
    return this.status(owner);
  }

  // ------------------------------------------------------- hosted checkout --

  private tokenSecret(): string {
    const secret = process.env.JWT_SECRET?.trim() || process.env.RAZORPAY_KEY_SECRET?.trim();
    if (!secret) {
      throw new ServiceUnavailableException("Checkout signing is not configured.");
    }
    return secret;
  }

  /** Short-lived capability that lets a browser (no JWT) pay ONE specific order. */
  issueCheckoutToken(orderId: string, now = Date.now()): string {
    const expires = now + CHECKOUT_TOKEN_TTL_MS;
    const signature = createHmac("sha256", this.tokenSecret())
      .update(`checkout:${orderId}:${expires}`)
      .digest("hex");
    return `${expires}.${signature}`;
  }

  verifyCheckoutToken(orderId: string, token: string | undefined, now = Date.now()): void {
    const [expiresText, signature] = (token ?? "").split(".");
    const expires = Number(expiresText);
    if (!signature || !Number.isFinite(expires) || expires < now) {
      throw new ForbiddenException("This checkout link has expired. Return to the app and try again.");
    }
    const expected = createHmac("sha256", this.tokenSecret())
      .update(`checkout:${orderId}:${expires}`)
      .digest();
    if (!safeEqualHex(expected, signature)) {
      throw new ForbiddenException("Invalid checkout link.");
    }
  }

  private hostedCheckoutUrl(publicBaseUrl: string, order: SubscriptionOrder): string {
    const token = this.issueCheckoutToken(order.id);
    return `${publicBaseUrl.replace(/\/$/, "")}/subscriptions/checkout-page/${order.id}?t=${token}`;
  }

  /** Data for the hosted checkout page. Only an unpaid order can be opened. */
  async hostedCheckoutDetails(orderId: string, token: string | undefined) {
    this.verifyCheckoutToken(orderId, token);
    const order = await this.prisma.subscriptionOrder.findUnique({ where: { id: orderId } });
    if (!order || order.status !== "CREATED") {
      throw new NotFoundException("This checkout is no longer available.");
    }
    const { plan } = this.planFor(order);
    return {
      keyId: this.razorpay.publicKeyId(),
      razorpayOrderId: order.razorpayOrderId,
      amount: order.amountPaise,
      currency: "INR" as const,
      description: `${plan.name} plan · ${order.billingCycle === "annual" ? "Annual" : "Monthly"}`,
    };
  }

  /** Browser callback from the hosted page: authorised by the signed token AND
   *  the Razorpay signature; the tenant comes from the stored order. */
  async hostedCheckoutCallback(
    orderId: string,
    token: string | undefined,
    input: { razorpayPaymentId: string; razorpaySignature: string },
  ) {
    this.verifyCheckoutToken(orderId, token);
    const order = await this.prisma.subscriptionOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException("Order not found.");
    const outcome = await this.verifyAndSettle(order, {
      razorpayOrderId: order.razorpayOrderId,
      razorpayPaymentId: input.razorpayPaymentId,
      razorpaySignature: input.razorpaySignature,
    });
    return { state: outcome.state, message: outcome.message };
  }

  // --------------------------------------------------------------- webhooks --

  verifyWebhookSignature(rawBody: Buffer, provided: string): void {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
    if (!secret) {
      throw new ServiceUnavailableException("Razorpay webhook secret is not configured.");
    }
    const expected = createHmac("sha256", secret).update(rawBody).digest();
    if (!safeEqualHex(expected, provided)) {
      throw new ForbiddenException("Razorpay webhook signature is invalid.");
    }
  }

  async processWebhook(
    rawBody: Buffer | undefined,
    signature: string | undefined,
    eventIdHeader: string | undefined,
  ) {
    if (!rawBody?.length || !signature) {
      throw new BadRequestException("A raw webhook body and signature are required.");
    }
    if (eventIdHeader && !/^[A-Za-z0-9._-]{1,120}$/.test(eventIdHeader)) {
      throw new BadRequestException("Invalid webhook event ID.");
    }
    this.verifyWebhookSignature(rawBody, signature);
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

    // Fast path for retries of an event we already finished.
    const seen = await this.prisma.razorpayWebhookEvent.findUnique({
      where: { providerEventId: eventId },
      select: { processedAt: true },
    });
    if (seen?.processedAt) return { received: true, duplicate: true };

    // Legacy recurring events (subscription.*), unknown events and payments that
    // are not ours are stored and acknowledged WITHOUT touching any access state.
    if (PAYMENT_EVENTS.has(eventType)) {
      const data = isRecord(payload.payload) ? payload.payload : {};
      const paymentEntity = this.entity(data.payment);
      const orderEntity = this.entity(data.order);
      const providerOrderId =
        stringValue(paymentEntity?.order_id) ?? stringValue(orderEntity?.id);
      const order = providerOrderId
        ? await this.prisma.subscriptionOrder.findUnique({
            where: { razorpayOrderId: providerOrderId },
          })
        : null;
      if (order) {
        await this.handleOrderEvent(eventType, order, paymentEntity);
      }
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
        // A concurrent delivery of the same event won the race. Order handling
        // above is idempotent, so this is simply a duplicate.
        return { received: true, duplicate: true };
      }
      throw error;
    }
    return { received: true, duplicate: false };
  }

  private async handleOrderEvent(
    eventType: string,
    order: SubscriptionOrder,
    paymentEntity: Record<string, unknown> | null,
  ): Promise<void> {
    const paymentId = stringValue(paymentEntity?.id);
    if (eventType === "payment.captured" || eventType === "order.paid") {
      // Never trust the payload: re-read the order's payments from Razorpay and
      // apply a captured one. Idempotent, so retries/duplicates/replays are safe
      // and ordering relative to the browser callback does not matter.
      await this.reconcileOrder(order);
      return;
    }
    if (!paymentEntity || !paymentId) return;
    const amount = numberValue(paymentEntity.amount);
    const currency = stringValue(paymentEntity.currency);
    if (amount !== order.amountPaise || currency !== order.currency) return;
    const payment: RazorpayPayment = {
      id: paymentId,
      order_id: order.razorpayOrderId,
      amount,
      currency,
      status: stringValue(paymentEntity.status) ?? eventType.replace("payment.", ""),
      method: stringValue(paymentEntity.method) ?? null,
      error_code: stringValue(paymentEntity.error_code) ?? null,
      error_description: stringValue(paymentEntity.error_description) ?? null,
      created_at: numberValue(paymentEntity.created_at),
    };
    if (eventType === "payment.authorized") {
      // Recorded only. Access needs a CAPTURED payment (see applyCapturedPayment).
      await this.savePayment(this.prisma, order, { ...payment, status: "authorized" });
    } else if (eventType === "payment.failed") {
      await this.savePayment(this.prisma, order, { ...payment, status: "failed" });
      // A failed attempt never invalidates a paid order or an active plan.
      await this.prisma.subscriptionOrder.updateMany({
        where: { id: order.id, status: "CREATED" },
        data: {
          failureCode: payment.error_code ?? "PAYMENT_FAILED",
          failureDescription: payment.error_description ?? "The payment failed.",
        },
      });
    }
  }

  private entity(value: unknown): Record<string, unknown> | null {
    if (!isRecord(value) || !isRecord(value.entity)) return null;
    return value.entity;
  }
}
