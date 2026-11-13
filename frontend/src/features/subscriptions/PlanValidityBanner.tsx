import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { colors } from "../../shared/theme/colors";
import { useAuth } from "../../core/auth/AuthProvider";
import { plans } from "./plans";
import { daysLeftLabel, formatDate, remainingDays, shouldShowPlanBanner } from "./format";

/**
 * Dashboard strip: plan name, validity and remaining time. Uses the session
 * summary only (no API call). It is hidden until the last 7 days before expiry,
 * then shows as a warning with a Renew shortcut for owners.
 */
export function PlanValidityBanner() {
  const { session } = useAuth();
  const router = useRouter();
  const subscription = session?.subscription;
  if (!subscription || subscription.status !== "ACTIVE" || !subscription.expiresAt) return null;

  const plan = plans.find((item) => item.id === subscription.planId);
  const days = remainingDays(subscription.expiresAt);
  // Hidden until the last 7 days before the plan expires.
  if (!shouldShowPlanBanner(days)) return null;
  const soon = true;
  return (
    <View
      testID="plan-validity-banner"
      accessibilityLabel="Plan validity"
      style={[styles.banner, soon && styles.soon]}
    >
      <View style={styles.text}>
        <Text style={[styles.title, soon && styles.soonText]}>
          {plan?.name ?? "Your"} plan · {subscription.billingCycle === "annual" ? "Annual" : "Monthly"}
        </Text>
        <Text style={[styles.detail, soon && styles.soonText]}>
          {daysLeftLabel(days)} · expires {formatDate(subscription.expiresAt)}
        </Text>
      </View>
      {subscription.canManageBilling ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Renew plan"
          onPress={() => router.push("/admin/subscription")}
          style={styles.button}
        >
          <Text style={styles.buttonText}>{soon ? "Renew now" : "Manage plan"}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
    padding: 14,
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.primaryLight,
  },
  soon: { backgroundColor: "#FFF4DD", borderColor: "#F0D08A" },
  text: { flexShrink: 1, gap: 2 },
  title: { fontSize: 15, fontWeight: "800", color: colors.text },
  detail: { fontSize: 13, color: colors.muted },
  soonText: { color: colors.warning },
  button: { minHeight: 40, justifyContent: "center", paddingHorizontal: 14, borderRadius: 10, backgroundColor: colors.primary },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
