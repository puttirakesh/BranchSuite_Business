import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "../../../core/auth/AuthContext";
import { getBusiness, updateBusinessStatus } from "../api/customers.api";
import type { BusinessDetails, BusinessStatus } from "../types";
import { getApiErrorMessage } from "../../../core/api/api-error";
import AppButton from "../../../shared/components/AppButton";
import AppModal from "../../../shared/components/AppModal";
import ErrorState from "../../../shared/components/ErrorState";
import LoadingState from "../../../shared/components/LoadingState";
import { colors } from "../../../theme/tokens";

export default function CustomerDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [business, setBusiness] = useState<BusinessDetails | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const request = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    if (!id || user?.role !== "PLATFORM_ADMIN") return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusiness(null);
    setBusy(true);
    setError("");
    try {
      const result = await getBusiness(id, controller.signal);
      if (!controller.signal.aborted) setBusiness(result);
    } catch (e) {
      if (!controller.signal.aborted) setError(getApiErrorMessage(e, "Unable to load business"));
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }, [id, user?.role]);
  useEffect(() => {
    void load();
    return () => { request.current?.abort(); };
  }, [load]);
  const applyStatus = async (next: BusinessStatus) => {
    if (!id || saving) return;
    setConfirming(false);
    setSaving(true);
    setError("");
    try {
      await updateBusinessStatus(id, next);
      await load();
    } catch (e) {
      setError(getApiErrorMessage(e, "Unable to change status"));
    } finally {
      setSaving(false);
    }
  };
  const nextStatus = business?.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
  if (authLoading) return <LoadingState />;
  if (user?.role !== "PLATFORM_ADMIN")
    return (
      <View style={styles.center}>
        <Text>Admin access required.</Text>
      </View>
    );
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.body}>
      <Pressable accessibilityRole="button" onPress={() => router.canGoBack() ? router.back() : router.replace('/(admin)/customers')}>
        <Text style={styles.link}>Back to businesses</Text>
      </Pressable>
      {busy && <ActivityIndicator style={{ margin: 20 }} />}
      {!!error && <ErrorState message={error} onRetry={() => { void load(); }} />}
      {!!business && (
        <>
          <Text style={styles.title}>{business.name}</Text>
          <Text style={styles.meta}>Business ID: {business.id}</Text>
          <View style={styles.card}>
            <Text style={styles.label}>Status</Text>
            <Text style={styles.value}>{business.status}</Text>
            <Text style={styles.label}>Companies / users</Text>
            <Text style={styles.value}>
              {business.companyCount} / {business.userCount}
            </Text>
            <Text style={styles.label}>Created</Text>
            <Text style={styles.value}>
              {new Date(business.createdAt).toLocaleDateString()}
            </Text>
            <Text style={styles.label}>Subscription</Text>
            <Text style={styles.value}>
              {business.subscription
                ? `${business.subscription.planId} · ${business.subscription.billingCycle} · ${business.subscription.status}`
                : "None"}
            </Text>
          </View>
          <Text style={styles.section}>Companies</Text>
          {business.companies.map((c) => (
            <View key={c.id} style={styles.card}>
              <Text style={styles.value}>{c.name}</Text>
              <Text style={styles.meta}>
                {c.status} · {c.branchCount} branches
              </Text>
            </View>
          ))}
          <View style={{ marginTop: 22 }}><AppButton
            title={business.status === "ACTIVE" ? "Mark business inactive" : "Mark business active"}
            disabled={busy} loading={saving} onPress={() => setConfirming(true)}
          /></View>
          <AppModal visible={confirming} title="Confirm status change"
            message={`Set ${business.name} to ${nextStatus}? This changes the business status only; existing sessions and subscriptions are unaffected.`}
            onCancel={() => setConfirming(false)} onConfirm={() => { void applyStatus(nextStatus); }} />
          <Text style={styles.note}>
            Changing tenant status does not automatically change user tokens or
            subscription status. Review authentication enforcement before
            treating it as account suspension.
          </Text>
        </>
      )}
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  body: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  link: { color: colors.primary, fontWeight: "700", marginBottom: 16 },
  title: { fontSize: 24, fontWeight: "800", color: colors.heading, marginBottom: 8 },
  meta: { fontSize: 12, color: colors.muted, marginTop: 5 },
  label: { fontSize: 12, color: colors.muted, marginTop: 12 },
  value: { fontSize: 16, fontWeight: "600", color: colors.heading, marginTop: 4 },
  section: {
    fontSize: 18,
    fontWeight: "700",
    marginVertical: 14,
    color: colors.heading,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 16,
    backgroundColor: colors.surface,
    marginTop: 10,
  },
  note: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 14 },
});
