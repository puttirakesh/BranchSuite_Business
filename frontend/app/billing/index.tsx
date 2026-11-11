import React, { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Redirect } from "expo-router";

import AuthScreen from "../../src/shared/components/ui/AuthScreen";
import AppButton from "../../src/shared/components/ui/AppButton";
import { colors } from "../../src/shared/theme/colors";
import { useAuth } from "../../src/core/auth/AuthProvider";
import { plans } from "../../src/features/subscriptions/plans";
import {
  NON_OWNER_BILLING_MESSAGE,
  billingCopy,
  subscriptionAccess,
  workspaceHome,
  type BillingReason,
} from "../../src/features/subscriptions/access";
import { lastFailureMessage } from "../../src/features/subscriptions/checkout";
import { useOrderCheckout } from "../../src/features/subscriptions/useOrderCheckout";
import { PaymentHistory } from "../../src/features/subscriptions/PaymentHistory";
import {
  formatDate,
  formatRupees,
  statusLabel,
} from "../../src/features/subscriptions/format";

/**
 * Billing gate. Lives OUTSIDE the /admin and /employee layouts so no protected
 * business API (branches, dashboard, ...) is called while the plan is unpaid or
 * expired. Covers first payment (Pay & Activate) and manual renewal after expiry.
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
  // Paid and active (e.g. right after payment): leave the gate for the workspace.
  if (access.kind === "allowed") return <Redirect href={workspaceHome(session)} />;

  return (
    <AuthScreen showBrand>
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
  const { session, signOut } = useAuth();
  const copy = billingCopy(reason);
  const checkout = useOrderCheckout(canManageBilling);
  const { status, phase, working, error, notice } = checkout;
  const [showDetails, setShowDetails] = useState(false);

  const expired = reason === "EXPIRED" || reason === "PAST_DUE" || reason === "CANCELLED";
  const catalog = plans.find(
    (plan) => plan.id === (status?.plan.id ?? session?.subscription?.planId),
  );
  const cycle = status?.billingCycle ?? session?.subscription?.billingCycle ?? null;
  const planLabel = status?.plan.name ?? catalog?.name ?? "—";
  const amountText = status
    ? formatRupees(status.amountPaise)
    : catalog && cycle
      ? formatRupees((cycle === "annual" ? catalog.annualPrice : catalog.monthlyPrice) * 100)
      : "—";
  const expiresAt = status?.expiresAt ?? session?.subscription?.expiresAt ?? null;
  const failure = status ? lastFailureMessage(status.paymentHistory) : null;
  const statusKey = status?.status ?? session?.subscription?.status ?? "";
  const payDisabled = status ? !status.canPay : false;
  const showSummary = canManageBilling && reason !== "UNKNOWN" && reason !== "MISSING";

  return (
    <View style={styles.card} accessibilityLabel="Subscription billing">
      <Text accessibilityRole="header" style={styles.title}>
        {copy.title}
      </Text>
      <Text style={styles.message}>
        {canManageBilling || reason === "UNKNOWN" ? copy.message : NON_OWNER_BILLING_MESSAGE}
      </Text>

      {showSummary ? (
        <View style={styles.summary}>
          <Row label="Plan" value={planLabel} />
          <Row
            label="Validity"
            value={cycle === "annual" ? "1 year per payment" : cycle === "monthly" ? "1 month per payment" : "—"}
          />
          <Row label="Price" value={`${amountText}${cycle === "annual" ? " / year" : cycle === "monthly" ? " / month" : ""}`} />
          <Row label="Status" value={statusLabel(statusKey)} />
          {expired && expiresAt ? <Row label="Expired on" value={formatDate(expiresAt)} /> : null}
          {checkout.loadingStatus ? <ActivityIndicator accessibilityLabel="Loading subscription" /> : null}
        </View>
      ) : null}

      {failure ? (
        <Text accessibilityRole="alert" style={styles.error}>
          Last payment attempt failed: {failure}. You can try again below.
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
      {status?.payBlockedReason ? <Text style={styles.notice}>{status.payBlockedReason}</Text> : null}

      {showDetails && status ? (
        <View style={styles.summary}>
          <Row label="Last payment" value={formatDate(status.lastPaymentAt)} />
          <Row label="Started" value={formatDate(status.currentPeriodStart ?? status.activatedAt)} />
          <Row label="Expiry" value={formatDate(status.expiresAt)} />
          <Text style={styles.rowLabel}>Payment history</Text>
          <PaymentHistory payments={status.paymentHistory} />
        </View>
      ) : null}

      <View style={styles.actions}>
        {canManageBilling && copy.canPay ? (
          <AppButton
            title={failure && !expired ? "Retry payment" : copy.actionLabel}
            onPress={() => void checkout.pay()}
            busy={working || phase === "checkout"}
            disabled={payDisabled}
          />
        ) : null}
        {expired && canManageBilling ? (
          <AppButton
            title={showDetails ? "Hide Plan Details" : "View Plan Details"}
            variant="outline"
            onPress={() => setShowDetails((value) => !value)}
          />
        ) : null}
        <AppButton
          title={phase === "timeout" ? "Check again" : "Refresh status"}
          variant="outline"
          onPress={() => void checkout.refreshNow()}
          disabled={working}
        />
        <AppButton title="Sign out" variant="outline" onPress={() => void signOut()} />
      </View>

      {canManageBilling && copy.canPay ? (
        <Text style={styles.footnote}>
          One-time payment — your card is not saved for automatic charges and nothing renews by itself.{" "}
          {status?.openOrder ? "" : ""}Your workspace opens only after Razorpay confirms the payment.
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
