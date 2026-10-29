import { AppIcon } from "../../src/ui/AppIcon";

import React, { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";

import AuthScreen from "../../src/shared/components/ui/AuthScreen";
import AppButton from "../../src/shared/components/ui/AppButton";
import { colors } from "../../src/shared/theme/colors";
import {
  plans,
  BillingCycle,
} from "../../src/features/subscriptions/plans";

export default function PlansScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();

  const [billing, setBilling] =
    useState<BillingCycle>("monthly");

  const columns = width >= 900 ? 3 : width >= 650 ? 2 : 1;

  return (
    <AuthScreen wide>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back to sign in"
        onPress={() => router.replace('/auth/login')}
        style={styles.back}
      >
        <AppIcon symbol="‹" size={16} color="#000" />
      </Pressable>

      <View style={styles.header}>
        

        <Text style={styles.title}>
          Choose the right plan
        </Text>

        
      </View>

      <View style={styles.billingSwitch}>
        {(["monthly", "annual"] as BillingCycle[]).map(
          (cycle) => (
            <Pressable
              key={cycle}
              accessibilityRole="button"
              accessibilityLabel={`${cycle === 'annual' ? 'Annual' : 'Monthly'} billing`}
              accessibilityState={{ selected: billing === cycle }}
              aria-pressed={billing === cycle}
              onPress={() => setBilling(cycle)}
              style={[
                styles.billingOption,
                billing === cycle && styles.billingActive,
              ]}
            >
              <Text
                style={[
                  styles.billingText,
                  billing === cycle && styles.billingTextActive,
                ]}
              >
                {cycle === "monthly" ? "Monthly" : "Annual"}
              </Text>
            </Pressable>
          )
        )}
      </View>

      <View style={styles.planGrid}>
        {plans.map((plan) => {

          return (
            <View
              key={plan.id}
              style={[
                styles.card,
                { width: columns === 1 ? "100%" : columns === 2 ? "48%" : "31.5%" },
                plan.popular && styles.popularCard,
              ]}
            >
              {plan.popular && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    MOST POPULAR
                  </Text>
                </View>
              )}

              <Text style={styles.planName}>{plan.name}</Text>

              <Text style={styles.description}>
                {plan.description}
              </Text>

              <View style={styles.divider} />

              <Text style={styles.sectionTitle}>
                Plan includes
              </Text>

              <View style={styles.features}>
                {plan.features.map((feature) => (
                  <View key={feature} style={styles.featureRow}>
                    <AppIcon symbol="✓" style={styles.check} />
                    <Text style={styles.featureText}>
                      {feature}
                    </Text>
                  </View>
                ))}
              </View>

              <AppButton
                title="Choose plan"
                onPress={() =>
                  router.push({
                    pathname: "/auth/signup",
                    params: {
                      plan: plan.id,
                      billing,
                    },
                  })
                }
              />
            </View>
          );
        })}
      </View>

      <Text style={styles.footer}>
        Pricing and plan limits will be confirmed before subscription activation.
      </Text>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  back: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
    paddingVertical: 8,
    marginBottom: 20,
  },
  backText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: "700",
  },
  header: {
    alignItems: "center",
    marginBottom: 28,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.primary,
    letterSpacing: 1.5,
    textAlign: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.text,
    marginTop: 10,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.muted,
    textAlign: "center",
    marginTop: 10,
    maxWidth: 500,
  },
  billingSwitch: {
    flexDirection: "row",
    alignSelf: "center",
    backgroundColor: colors.primaryLight,
    borderRadius: 14,
    padding: 5,
    marginBottom: 30,
  },
  billingOption: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  billingActive: {
    backgroundColor: colors.primary,
  },
  billingText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700",
  },
  billingTextActive: {
    color: "#FFFFFF",
  },
  planGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "stretch",
    gap: 16,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 22,
    minWidth: 0,
  },
  popularCard: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  badge: {
    backgroundColor: colors.primaryLight,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 15,
  },
  badgeText: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: "800",
  },
  planName: {
    fontSize: 21,
    fontWeight: "800",
    color: colors.text,
  },
  description: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 6,
    lineHeight: 18,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginTop: 20,
    flexWrap: "wrap",
  },
  price: {
    fontSize: 30,
    fontWeight: "800",
    color: colors.text,
  },
  period: {
    fontSize: 13,
    color: colors.muted,
    marginLeft: 4,
  },
  trial: {
    color: colors.success,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 7,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 14,
  },
  limit: {
    color: colors.text,
    fontSize: 13,
    marginBottom: 12,
  },
  features: {
    flexGrow: 1,
    marginBottom: 22,
  },
  featureRow: {
    flexDirection: "row",
    marginBottom: 12,
    alignItems: "flex-start",
  },
  check: {
    color: colors.success,
    fontWeight: "800",
    marginRight: 10,
  },
  featureText: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    lineHeight: 20,
  },
  footer: {
    textAlign: "center",
    color: colors.muted,
    fontSize: 12,
    marginTop: 30,
  },
});
