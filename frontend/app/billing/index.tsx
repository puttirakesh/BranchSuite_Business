import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Linking,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Redirect } from "expo-router";

import AuthScreen from "../../src/shared/components/ui/AuthScreen";
import AppButton from "../../src/shared/components/ui/AppButton";
import { colors } from "../../src/shared/theme/colors";
import { useAuth } from "../../src/core/auth/AuthProvider";
import { apiErrorMessage } from "../../src/core/admin/http";
import { plans } from "../../src/features/subscriptions/plans";
import {
  NON_OWNER_BILLING_MESSAGE,
  billingCopy,
  subscriptionAccess,
  workspaceHome,
  type BillingReason,
} from "../../src/features/subscriptions/access";
import {
  billingApi,
  type BillingStatus,
} from "../../src/features/subscriptions/billing.api";
import {
  lastFailureMessage,
  openWebCheckout,
  pollUntil,
} from "../../src/features/subscriptions/checkout";

const formatRupees = (paise: number) =>
  `₹${new Intl.NumberFormat("en-IN").format(paise / 100)}`;

const STATUS_LABEL: Record<string, string> = {
  PENDING_ACTIVATION: "Awaiting payment",
  ACTIVE: "Active",
  PAST_DUE: "Payment overdue",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
  MISSING: "Not found",
};

type Phase =
  | "idle"
  | "starting"
  | "checkout"
  | "verifying"
  | "processing"
  | "timeout";

/**
 * Billing gate. Lives OUTSIDE the /admin and /employee layouts so no protected
 * business API (branches, dashboard, ...) is called while payment is pending.
 */
export default function BillingScreen() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" accessibilityLabel="Loading" />
      </View>
    );
  }
  if (!session) return <Redirect href="/auth/login" />;

  const access = subscriptionAccess(session);
  // Active (e.g. after payment): leave the billing gate for the right workspace.
  if (access.kind === "allowed") return <Redirect href={workspaceHome(session)} />;

  return (
    <AuthScreen>
      <BillingContent
        reason={access.reason}
        canManageBilling={access.canManageBilling}
      />
    </AuthScreen>
  );
}

function BillingContent({
  reason,
  canManageBilling,
}: {
  reason: BillingReason;
  canManageBilling: boolean;
}) {
  const { session, refreshSession, signOut } = useAuth();
  const copy = billingCopy(reason);

  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(canManageBilling);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const mounted = useRef(true);
  // Request deduplication: a second tap while one is running is ignored.
  const busy = useRef(false);
  const awaitingReturn = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  /** One backend reconcile with Razorpay + refresh of the cached session. */
  const reconcile = useCallback(async () => {
    const next = await billingApi.refresh();
    if (mounted.current) setStatus(next);
    // The session summary drives routing; refresh it whenever the backend says
    // access is now allowed so this screen redirects to the workspace.
    if (next.accessAllowed) await refreshSession();
    return next;
  }, [refreshSession]);

  /** Bounded wait for the backend to confirm ACTIVE. */
  const awaitActivation = useCallback(async () => {
    setPhase("processing");
    setError("");
    setNotice("Payment received. Waiting for Razorpay to confirm your subscription…");
    const result = await pollUntil({
      step: reconcile,
      done: (value) => value.accessAllowed,
      shouldStop: () => !mounted.current,
    });
    if (!mounted.current) return;
    if (result.state === "done") return; // routing redirects to the workspace
    setPhase("timeout");
    setNotice("");
    setError(
      "We are still waiting for confirmation from Razorpay. Your payment is not lost — refresh in a minute. If it was charged, access starts as soon as it is confirmed.",
    );
  }, [reconcile]);

  const loadStatus = useCallback(async () => {
    if (!canManageBilling) return;
    setLoadingStatus(true);
    try {
      const current = await billingApi.status();
      if (!mounted.current) return;
      setStatus(current);
      setError("");
    } catch (cause) {
      if (mounted.current) setError(apiErrorMessage(cause, "Could not load your subscription."));
    } finally {
      if (mounted.current) setLoadingStatus(false);
    }
  }, [canManageBilling]);

  // Mount / browser refresh / app restart: read the local status, then ask the
  // backend to reconcile once in case a payment completed while we were away.
  useEffect(() => {
    if (!canManageBilling) return;
    let cancelled = false;
    (async () => {
      await loadStatus();
      if (cancelled) return;
      try {
        const next = await reconcile();
        if (!cancelled && mounted.current) setStatus(next);
      } catch {
        // Reconcile is best effort here; the explicit buttons report errors.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canManageBilling, loadStatus, reconcile]);

  // App backgrounding (native hosted checkout): on return, check the outcome.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active" && awaitingReturn.current && !busy.current) {
        awaitingReturn.current = false;
        busy.current = true;
        void awaitActivation().finally(() => {
          busy.current = false;
        });
      }
    });
    return () => subscription.remove();
  }, [awaitActivation]);

  const refreshNow = async () => {
    if (busy.current) return;
    busy.current = true;
    setError("");
    setNotice("");
    setPhase("starting");
    try {
      if (canManageBilling) {
        const next = await reconcile();
        if (mounted.current && !next.accessAllowed) {
          setNotice("Status updated. Your subscription is not active yet.");
        }
      } else {
        // Non-owners: re-read the session; the owner may have paid meanwhile.
        const refreshed = await refreshSession();
        if (mounted.current && subscriptionAccess(refreshed).kind !== "allowed") {
          setNotice("Your business subscription is still not active.");
        }
      }
    } catch (cause) {
      if (mounted.current) setError(apiErrorMessage(cause, "Could not refresh your status."));
    } finally {
      busy.current = false;
      if (mounted.current) setPhase("idle");
    }
  };

  const pay = async () => {
    if (busy.current || !canManageBilling) return;
    busy.current = true;
    setError("");
    setNotice("");
    setPhase("starting");
    try {
      // Reuses the existing Razorpay subscription when it is still valid; the
      // backend serialises this so repeated taps never create duplicates.
      const checkout = await billingApi.checkout();
      if (!mounted.current) return;

      const webCheckoutPossible = Platform.OS === "web";
      if (webCheckoutPossible) {
        setPhase("checkout");
        try {
          const outcome = await openWebCheckout(checkout, {
            name: session?.user.name,
            email: session?.user.email,
          });
          if (!mounted.current) return;
          if (outcome.outcome === "success") {
            setPhase("verifying");
            try {
              await billingApi.verify(outcome.response);
            } catch (cause) {
              // Verification errors never grant access; polling below still
              // asks the backend for the authoritative state.
              if (mounted.current) setError(apiErrorMessage(cause, "We could not verify the payment yet."));
            }
            await awaitActivation();
            return;
          }
          setPhase("idle");
          if (outcome.outcome === "dismissed") {
            setNotice("Checkout was closed. You can try again whenever you are ready.");
          } else {
            setError(`Payment failed: ${outcome.message}`);
          }
          // The attempt may still have been recorded; show the latest state.
          await reconcile().catch(() => undefined);
          return;
        } catch {
          // checkout.js unavailable (offline / blocked): fall back to the hosted page.
        }
      }

      if (!checkout.checkoutUrl) {
        setPhase("idle");
        setError("Razorpay did not provide a payment link. Please try again.");
        return;
      }
      awaitingReturn.current = true;
      setPhase("checkout");
      setNotice(
        "Complete the payment in the page that opened, then return here. We will confirm it automatically.",
      );
      await Linking.openURL(checkout.checkoutUrl);
    } catch (cause) {
      if (mounted.current) {
        setPhase("idle");
        setError(apiErrorMessage(cause, "Could not start the payment. Please try again."));
      }
    } finally {
      busy.current = false;
    }
  };

  const planLabel = status?.plan.name ??
    plans.find((plan) => plan.id === session?.subscription?.planId)?.name ??
    "—";
  const cycle = status?.billingCycle ?? session?.subscription?.billingCycle ?? null;
  const catalog = plans.find((plan) => plan.id === (status?.plan.id ?? session?.subscription?.planId));
  const amountText = status
    ? formatRupees(status.amountPaise)
    : catalog && cycle
      ? `₹${new Intl.NumberFormat("en-IN").format(cycle === "annual" ? catalog.annualPrice : catalog.monthlyPrice)}`
      : "—";
  const failure = status ? lastFailureMessage(status.paymentHistory) : null;
  const working = phase === "starting" || phase === "verifying" || phase === "processing";
  const statusKey = status?.status ?? session?.subscription?.status ?? "";

  return (
    <View style={styles.card} accessibilityLabel="Subscription activation">
      <Text accessibilityRole="header" style={styles.title}>
        {copy.title}
      </Text>
      <Text style={styles.message}>
        {canManageBilling || reason === "UNKNOWN" ? copy.message : NON_OWNER_BILLING_MESSAGE}
      </Text>

      {canManageBilling && reason !== "UNKNOWN" && reason !== "MISSING" ? (
        <View style={styles.summary}>
          <Row label="Plan" value={planLabel} />
          <Row
            label="Billing"
            value={cycle === "annual" ? "Annual (billed every year)" : cycle === "monthly" ? "Monthly (billed every month)" : "—"}
          />
          <Row label="Amount" value={`${amountText}${cycle === "annual" ? " / year" : cycle === "monthly" ? " / month" : ""}`} />
          <Row label="Status" value={STATUS_LABEL[statusKey] ?? "Unknown"} />
          {status?.providerStatus ? (
            <Row label="Payment provider" value={status.providerStatus} />
          ) : null}
          {loadingStatus ? <ActivityIndicator accessibilityLabel="Loading subscription" /> : null}
        </View>
      ) : null}

      {failure ? (
        <Text accessibilityRole="alert" style={styles.error}>
          Last payment attempt failed: {failure}. You can retry authorisation below.
        </Text>
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
      {notice ? (
        <View style={styles.noticeRow} accessibilityLiveRegion="polite">
          {working ? <ActivityIndicator size="small" /> : null}
          <Text style={styles.notice}>{notice}</Text>
        </View>
      ) : null}
      {phase === "checkout" && Platform.OS === "web" && !notice ? (
        <Text style={styles.notice}>Razorpay checkout is open…</Text>
      ) : null}

      <View style={styles.actions}>
        {canManageBilling && copy.canPay ? (
          <AppButton
            title={failure ? "Retry authorisation" : copy.actionLabel}
            onPress={() => void pay()}
            busy={working || phase === "checkout"}
          />
        ) : null}
        <AppButton
          title={phase === "timeout" ? "Check again" : "Refresh status"}
          variant="outline"
          onPress={() => void refreshNow()}
          disabled={working}
        />
        <AppButton title="Sign out" variant="outline" onPress={() => void signOut()} />
      </View>

      {canManageBilling && copy.canPay ? (
        <Text style={styles.footnote}>
          {status?.keyId?.startsWith("rzp_test_")
            ? "Test Mode: payments use Razorpay's test environment and create no real charges. "
            : ""}
          Your workspace opens only after Razorpay confirms the payment.
        </Text>
      ) : null}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: {
    width: "100%",
    gap: 16,
    padding: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
  },
  title: { fontSize: 24, fontWeight: "800", color: colors.text },
  message: { fontSize: 15, lineHeight: 22, color: colors.muted },
  summary: {
    gap: 10,
    padding: 14,
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
  },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12, flexWrap: "wrap" },
  rowLabel: { fontSize: 14, color: colors.muted },
  rowValue: { fontSize: 15, fontWeight: "700", color: colors.text, flexShrink: 1 },
  error: { fontSize: 14, lineHeight: 20, color: colors.danger },
  noticeRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  notice: { fontSize: 14, lineHeight: 20, color: colors.primaryDark, flexShrink: 1 },
  actions: { gap: 12 },
  footnote: { fontSize: 12, lineHeight: 18, color: colors.muted },
});
