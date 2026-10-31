import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../../core/auth/AuthContext";
import { listBusinesses } from "../api/customers.api";
import type { BusinessListResponse, BusinessStatus } from "../types";
import { getApiErrorMessage } from "../../../core/api/api-error";
import ErrorState from "../../../shared/components/ErrorState";
import LoadingState from "../../../shared/components/LoadingState";
import { colors } from "../../../theme/tokens";

export default function CustomersScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<BusinessStatus | undefined>();
  const [page, setPage] = useState(1);
  const [data, setData] = useState<BusinessListResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    if (user?.role !== "PLATFORM_ADMIN") return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError("");
    try {
      setData(
        await listBusinesses({
          search: search.trim() || undefined,
          status,
          page,
          limit: 20,
        }, controller.signal),
      );
    } catch (e) {
      if (!controller.signal.aborted) setError(getApiErrorMessage(e, "Unable to load businesses"));
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }, [user?.role, search, status, page]);
  useEffect(() => {
    const timer = setTimeout(() => { void load(); }, 250);
    return () => { clearTimeout(timer); request.current?.abort(); };
  }, [load]);
  if (authLoading) return <LoadingState />;
  if (user?.role !== "PLATFORM_ADMIN")
    return (
      <View style={styles.center}>
        <Text>Admin access required.</Text>
      </View>
    );
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Businesses</Text>
      <Text style={styles.sub}>
        View registered tenants, companies, and subscription status.
      </Text>
      <TextInput
        style={styles.input}
        placeholder="Search business or company"
        value={search}
        onChangeText={(v) => {
          setSearch(v);
          setPage(1);
        }}
        autoCapitalize="none"
        maxLength={100}
        accessibilityLabel="Search business or company"
      />
      <View style={styles.row}>
        {(["ALL", "ACTIVE", "INACTIVE"] as const).map((s) => (
          <Pressable
            key={s}
            accessibilityRole="button"
            accessibilityState={{ selected: (status ?? "ALL") === s }}
            onPress={() => {
              setStatus(s === "ALL" ? undefined : s);
              setPage(1);
            }}
            style={[
              styles.chip,
              (status ?? "ALL") === s && styles.chipSelected,
            ]}
          >
            <Text
              style={
                (status ?? "ALL") === s
                  ? styles.chipTextSelected
                  : styles.chipText
              }
            >
              {s}
            </Text>
          </Pressable>
        ))}
      </View>
      {busy && <ActivityIndicator style={{ marginVertical: 12 }} />}
      {!!error && <ErrorState message={error} onRetry={() => { void load(); }} />}
      <FlatList
        data={data?.items ?? []}
        keyExtractor={(x) => x.id}
        refreshing={busy}
        onRefresh={() => void load()}
        ListEmptyComponent={
          !busy && !error ? <Text style={styles.empty}>No businesses found.</Text> : null
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`View ${item.name}`}
            onPress={() =>
              router.push({
                pathname: "/(admin)/customers/[id]",
                params: { id: item.id },
              })
            }
            style={styles.card}
          >
            <View style={styles.between}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.status}>{item.status}</Text>
            </View>
            <Text style={styles.meta}>
              {item.companyCount} companies · {item.userCount} users
            </Text>
            <Text style={styles.meta}>
              Plan: {item.subscription?.planId ?? "None"} ·{" "}
              {item.subscription?.status ?? "No subscription"}
            </Text>
          </Pressable>
        )}
        ListFooterComponent={
          <View style={styles.footer}>
            <Pressable
              disabled={page <= 1 || busy}
              onPress={() => setPage((n) => Math.max(1, n - 1))}
            >
              <Text style={styles.link}>Previous</Text>
            </Pressable>
            <Text>
              Page {page} of {data?.totalPages || 1}
            </Text>
            <Pressable
              disabled={busy || page >= (data?.totalPages || 1)}
              onPress={() => setPage((n) => n + 1)}
            >
              <Text style={styles.link}>Next</Text>
            </Pressable>
          </View>
        }
      />
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 20 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 26, fontWeight: "800", color: colors.heading },
  sub: { fontSize: 13, color: colors.muted, marginBottom: 14 },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  row: { flexDirection: "row", gap: 8, marginBottom: 12, flexWrap: "wrap" },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text },
  chipTextSelected: { color: colors.surface },
  empty: { textAlign: "center", padding: 24, color: colors.muted },
  card: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  between: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  name: { fontSize: 17, fontWeight: "700", color: colors.heading, flex: 1 },
  status: { fontSize: 11, fontWeight: "700", color: colors.primary },
  meta: { color: colors.muted, fontSize: 12, marginTop: 7 },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 18,
  },
  link: { color: colors.primary, fontWeight: "700" },
});
