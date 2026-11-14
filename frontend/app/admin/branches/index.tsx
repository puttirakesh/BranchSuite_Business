import { KeyboardAwareScrollView as ScrollView } from '../../../src/ui/KeyboardAwareScrollView';
import { useToastState } from '../../../src/ui/useToastState';
import { AdminPageHeading, useWebSectionHeader } from '../../../src/ui/AdminPageHeading';
import { SearchField } from '../../../src/ui/SearchField';
import { AppIcon } from "../../../src/ui/AppIcon";
import { Dropdown } from "../../../src/ui/Dropdown";
import { DesktopEyebrow } from '../../../src/ui/DesktopEyebrow';
import { CompanyName, selectAdminBranch, useAdminScope } from "../../../src/core/admin/scope";
import React, { useCallback, useState } from "react";

import { useWorkspaceFocusEffect as useFocusEffect } from '../../../src/core/admin/useWorkspaceFocusEffect';
import { branchesApi } from "../../../src/core/admin/api";
import {
  getAdminScope,
} from "../../../src/core/admin/scope";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { AdminBottomNavigation } from "../../../src/ui/AdminBottomNavigation";
import { useAdminLayout } from "../../../src/ui/useAdminLayout";
import { useAdminViewport } from "../../../src/ui/useAdminViewport";

import { branchDraft, type BranchDraft as Branch } from "../../../src/core/admin/branch-form";
const initialBranches: Branch[] = [];

function BuildingIcon() { return <AppIcon name="git-branch" size={24} color="#345cf2" />; }

export default function BranchManagementPage() {
  const webHeader = useWebSectionHeader();
  const router = useRouter();
  const scope = useAdminScope();
  const { desktop } = useAdminViewport();
  const { styles } = useAdminLayout(baseStyles);
  const [branches, setBranches] = useState(initialBranches);
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useToastState("", 'error');
  const [loaded, setLoaded] = useState(false);
  const [refreshCount, setRefreshCount] = useState(0);
  const [search, setSearch] = useState('');
  const branchOptions = [
    { value: '', label: 'All branches' },
    ...branches.filter(branch => branch.active).map(branch => ({ value: branch.id, label: branch.name })),
  ];
  const chooseBranch = (value: string) => {
    void selectAdminBranch(value || null)
      .then(() => setSelectedId(value))
      .catch(cause => setError(cause instanceof Error ? cause.message : 'Could not change branch.'));
  };
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoaded(false);
      setError("");
      async function load() {
        try {
          const scope = await getAdminScope();
          const results = await branchesApi.list(scope.companyId);
          if (!active) return;
          setBranches(results.map(branchDraft));
          setSelectedId(scope.branchId ?? "");
        } catch (reason) {
          if (active)
            setError(
              reason instanceof Error
                ? reason.message
                : "Could not load branches from the server.",
            );
        } finally {
          if (active) setLoaded(true);
        }
      }
      void load();
      return () => {
        active = false;
      };
    }, [refreshCount]),
  );

  const edit = (branch: Branch) => router.push({ pathname: '/admin/branches/[id]/edit', params: { id: branch.id } });

  return (
    <SafeAreaView edges={["left", "right"]} style={styles.safe}>
      <View style={styles.page}>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <AdminPageHeading title="Branch management" style={{ marginBottom: 16 }} branchControl={webHeader ? <Dropdown label="Branch" value={selectedId} options={branchOptions} onChange={chooseBranch} style={styles.headerBranch} /> : undefined} onRefresh={() => setRefreshCount(value => value + 1)} refreshing={!loaded}><Pressable
              accessibilityRole="button"
              accessibilityLabel="Add branch"
              disabled={!loaded || !!error}
              onPress={() => router.push("/admin/branches/create")}
              style={[styles.addButton, !loaded && styles.dim]}
            >
              <Text style={styles.addText}>+ Add</Text>
            </Pressable></AdminPageHeading>
          {!webHeader && <View style={styles.branchCard}>
            <View style={styles.branchDotHalo}>
              <View style={styles.branchDot} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.branchTitle}>Viewing branches</Text>
              <Text style={styles.caption}><CompanyName /> · Filter by branch</Text>
            </View>
            <Dropdown valueOnly label="Branch" value={selectedId} options={branchOptions} onChange={chooseBranch} style={styles.mobileBranch} />
          </View>}
          {!loaded && (
            <ActivityIndicator
              accessibilityLabel="Loading branches"
              color="#345cf2"
            />
          )}
          {Boolean(error) && (
            <Pressable
              accessibilityRole="button"
              onPress={() => setRefreshCount((value) => value + 1)}
              style={styles.change}
            >
              <Text style={styles.link}>Retry loading branches</Text>
            </Pressable>
          )}
          {(
            <SearchField
              accessibilityLabel="Search branches by name or code"
              value={search}
              onChangeText={setSearch}
            />
          )}
          {error ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          ) : null}
          <View style={styles.cards}>
            {branches
              .filter(
                (branch) =>
                  (!selectedId || branch.id === selectedId) &&
                  `${branch.name} ${branch.code}`
                    .toLowerCase()
                    .includes(search.trim().toLowerCase()),
              )
              .map((branch) => (
                <View
                  key={branch.id}
                  style={[styles.card, desktop && styles.desktopCard]}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.buildingIcon}>
                      <BuildingIcon />
                    </View>
                    <View style={styles.flex}>
                      <Text style={styles.cardTitle}>{branch.name}</Text>
                      <Text style={styles.caption}>
                        {branch.code} · {branch.location || "Location not set"}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.badge,
                        !branch.active && styles.inactiveBadge,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          !branch.active && styles.inactiveText,
                        ]}
                      >
                        {branch.active ? "Active" : "Inactive"}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.cardMeta}>
                    <Text style={styles.caption}>
                      Manager: {branch.managerUserName || branch.manager || "Unassigned"}
                    </Text>
                    <Text style={styles.caption}>
                      {branch.employees} active employee profiles
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${branch.name} branch details`}
                    disabled={!loaded}
                    onPress={() => edit(branch)}
                    style={({ pressed }) => [
                      styles.secondary,
                      pressed && styles.dim,
                    ]}
                  >
                    <Text style={styles.buttonText}>Edit branch details</Text>
                  </Pressable>
                </View>
              ))}
          </View>
          {loaded && !error &&
            !branches.some((branch) =>
              `${branch.name} ${branch.code}`
                .toLowerCase()
                .includes(search.trim().toLowerCase()),
            ) && <Text style={styles.subtitle}>No branches found.</Text>}
        </ScrollView>
        <AdminBottomNavigation />
      </View>
    </SafeAreaView>
  );
}

const baseStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f6f8fd" },
  page: { flex: 1, width: "100%", maxWidth: 1280, alignSelf: "center" },
  flex: { flex: 1, minWidth: 0 },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e4eaf5",
  },
  // Dialog controls must not inherit useAdminLayout's short-screen page-header hiding.
  dialogHeader: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44, flexShrink: 0 },
  companyName: { fontSize: 13, fontWeight: "800", color: "#20334f" },
  headerCaption: { fontSize: 9, color: "#71829c", lineHeight: 14 },
  muted: { color: "#71829c" },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 13,
    backgroundColor: "#eaf0ff",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#345cf2", fontSize: 12, fontWeight: "700" },
  searchButton: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: "#f6f8fd",
    alignItems: "center",
    justifyContent: "center",
  },
  searchGlass: {
    width: 14,
    height: 14,
    borderWidth: 1.5,
    borderColor: "#20334f",
    borderRadius: 7,
  },
  headerFilters: { flexDirection: "row", gap: 8, marginTop: 14 },
  headerFilter: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#e4eaf5",
    borderRadius: 8,
    backgroundColor: "#f7f9ff",
  },
  filterText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#20334f",
    flexShrink: 1,
  },
  selectedFilter: { backgroundColor: "#eaf0ff", borderColor: "#d5dfff" },
  content: { padding: 16, paddingTop: 20, paddingBottom: 24, gap: 16 },
  heading: { flexDirection: "row", flexWrap: "nowrap", alignItems: "center", gap: 10 },
  back: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  eyebrow: {
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 1.5,
    color: "#71829c",
  },
  title: { minWidth: 0, flexShrink: 1, fontSize: 20, lineHeight: 26, fontWeight: "700", color: "#20334f", marginTop: 0 },
  subtitle: { fontSize: 11, lineHeight: 18, color: "#71829c", marginTop: 4 },
  addButton: {
    backgroundColor: "#345cf2",
    borderRadius: 12,
    minHeight: 40,
    paddingHorizontal: 13,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  addText: { fontSize: 12, fontWeight: "700", color: "#fff" },
  branchCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "#e4eaf5",
    borderRadius: 16,
    backgroundColor: "#fff",
  },
  branchDotHalo: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#dcf5ef",
    alignItems: "center",
    justifyContent: "center",
  },
  branchDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#39b8a7",
  },
  branchTitle: { fontSize: 11, fontWeight: "700", color: "#20334f" },
  caption: { fontSize: 10, lineHeight: 16, color: "#71829c", marginTop: 4 },
  change: { minHeight: 36, justifyContent: "center", paddingHorizontal: 4 },
  link: { fontSize: 11, fontWeight: "700", color: "#345cf2" },
  cards: { gap: 10, flexDirection: "row", flexWrap: "wrap" },
  card: {
    width: "100%",
    padding: 16,
    borderWidth: 1,
    borderColor: "#e4eaf5",
    borderRadius: 19,
    backgroundColor: "#fff",
  },
  desktopCard: { width: "48%", flexGrow: 1 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  cardTitle: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "700",
    color: "#20334f",
  },
  buildingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#dcf5ef",
    alignItems: "center",
    justifyContent: "center",
  },
  building: {
    width: 12,
    height: 16,
    borderWidth: 1,
    borderColor: "#008e85",
    borderBottomWidth: 2,
  },
  windows: { padding: 2, gap: 2 },
  windowRow: { flexDirection: "row", gap: 2 },
  window: { width: 2, height: 1, backgroundColor: "#008e85" },
  buildingSide: {
    position: "absolute",
    right: -5,
    bottom: -2,
    width: 4,
    height: 11,
    borderWidth: 1,
    borderColor: "#008e85",
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 7,
    backgroundColor: "#dff3ea",
  },
  statusText: { fontSize: 9, fontWeight: "700", color: "#08765c" },
  inactiveBadge: { backgroundColor: "#edf0f5" },
  inactiveText: { color: "#607591" },
  cardMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 16,
    marginBottom: 14,
  },
  secondary: {
    minHeight: 40,
    borderWidth: 1,
    borderColor: "#dce5f3",
    borderRadius: 12,
    padding: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  buttonText: { fontSize: 12, fontWeight: "600", color: "#405573" },
  headerBranch: { width: 180 },
  mobileBranch: { width: 138, marginBottom: 0 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#405573",
    marginBottom: 6,
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: "#dce5f3",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#20334f",
    backgroundColor: "#fff",
  },
  statusOptions: { flexDirection: "row", gap: 8 },
  error: { fontSize: 13, lineHeight: 20, color: "#b94d61" },
  dim: { opacity: 0.6 },
});
