import { SearchField } from './SearchField';
import { FloatingTextInput as TextInput } from "./FloatingTextInput";
import { AppIcon } from "./AppIcon";
import { useDesktopStyles } from "./useDesktopStyles";
import React, { useEffect, useMemo, useState } from "react";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../core/auth/AuthProvider";
import { useAvailableBranches } from "../core/admin/available-branches";
import { BranchOptionsStatus } from "./BranchOptionsStatus";
import { colors } from "../shared/theme/colors";
import { RESPONSIVE_BREAKPOINTS } from "./responsiveBreakpoints";
import { getAdminDestinations, filterDestinations } from './workspace-navigation';
import {
  useAdminScope,
  selectAdminWorkspace,
  getSelectedBranchId,
} from "../core/admin/scope";

const ADMIN = [
  "BUSINESS_OWNER",
  "BUSINESS_ADMIN",
  "BRANCH_MANAGER",
  "SALES_MANAGER",
  "HR_MANAGER",
  "PAYROLL_MANAGER",
];
export function AdminWorkspaceHeader({ onOpenNavigation }: { onOpenNavigation?: () => void }) {
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === "web" && width >= RESPONSIVE_BREAKPOINTS.desktop;
  const densityStyles = useDesktopStyles(baseStyles);
  const styles = useMemo(() => desktop ? {
    ...densityStyles,
    header: { ...densityStyles.header, height: 64 },
    title: { ...densityStyles.title, fontSize: 17, lineHeight: 23 },
    subtitle: { ...densityStyles.subtitle, fontSize: 12, lineHeight: 18, marginTop: 2 },
    filter: { ...densityStyles.filter, minHeight: 46, borderRadius: 9 },
    filterLabel: { ...densityStyles.filterLabel, fontSize: 10, lineHeight: 14 },
    filterValue: { ...densityStyles.filterValue, fontSize: 13, lineHeight: 19 },
    option: { ...densityStyles.option, minHeight: 54, padding: 10, borderRadius: 10 },
    optionName: { ...densityStyles.optionName, fontSize: 14, lineHeight: 20 },
    heading: { ...densityStyles.heading, fontSize: 19, lineHeight: 25 },
  } : densityStyles, [densityStyles, desktop]);
  const narrow = width < RESPONSIVE_BREAKPOINTS.tablet;
  const compact = width < 390;
  const medium = width >= 390 && width < RESPONSIVE_BREAKPOINTS.tablet;
  const tablet = width >= RESPONSIVE_BREAKPOINTS.tablet && width < RESPONSIVE_BREAKPOINTS.desktop;
  const { session } = useAuth();
  const scope = useAdminScope();
  const router = useRouter();
  const [modal, setModal] = useState<
    "business" | "company" | "branch" | "search" | null
  >(null);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const memberships = useMemo(
    () =>
      (session?.memberships ?? []).filter(
        (m) => (m.roles ?? [m.role]).some(role => ADMIN.includes(role)) && m.branches.length > 0,
      ),
    [session],
  );
  const companies = useMemo(
    () =>
      memberships.filter(
        (m, i, arr) =>
          arr.findIndex((other) => other.companyId === m.companyId) === i,
      ),
    [memberships],
  );
  const active =
    companies.find((m) => m.companyId === scope?.companyId) ?? companies[0];
  const {
    branches,
    loading: branchesLoading,
    error: branchesError,
    refresh: refreshBranches,
  } = useAvailableBranches(active?.companyId);
  const branchId = scope?.branchId ?? null;
  const selectedBranch = branches.find((b) => b.id === branchId)
    ?? (branchesLoading ? scope?.branches.find(b => b.id === branchId) : undefined);
  const results = filterDestinations(getAdminDestinations(session, scope?.companyId), search);
  useEffect(() => {
    if (modal) setMessage("");
    if (modal === "branch") refreshBranches();
  }, [modal, refreshBranches]);
  const switchTo = (companyId: string, nextBranchId: string | null) => {
    try {
      const currentMemberships = memberships.map(membership =>
        membership.companyId === active?.companyId && !branchesLoading && !branchesError
          ? { ...membership, branches }
          : membership,
      );
      selectAdminWorkspace(companyId, nextBranchId, currentMemberships);
      setModal(null);
      router.replace("/admin/dashboard");
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Workspace selection failed.",
      );
    }
  };
  return (
    <>
      <View
        style={[
          styles.header,
          narrow && styles.headerSmall,
          compact && styles.headerCompact,
          tablet && styles.headerTablet,
        ]}
      >
        {onOpenNavigation && <Pressable accessibilityRole="button" accessibilityLabel="Open navigation" onPress={onOpenNavigation} style={{ width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: colors.primaryLight }}><AppIcon name="menu" size={20} color={colors.primary} /></Pressable>}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Switch business"
          onPress={() => setModal("business")}
          style={styles.titlePress}
        >
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            style={[
              styles.title,
              narrow && styles.titleSmall,
              compact && styles.titleCompact,
              medium && styles.titleMedium,
              tablet && styles.titleTablet,
            ]}
          >
            {scope?.companyName || "Business workspace"}
          </Text>
          <Text
            numberOfLines={1}
            style={[
              styles.subtitle,
              narrow && styles.subtitleSmall,
              compact && styles.subtitleCompact,
            ]}
          >
            BUSINESS WORKSPACE
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Search modules"
          style={[
            styles.searchButton,
            narrow && styles.searchButtonSmall,
            compact && styles.searchButtonCompact,
          ]}
          onPress={() => {
            setSearch("");
            setModal("search");
          }}
        >
          <AppIcon symbol="⌕" style={[styles.searchIcon, narrow && styles.searchIconSmall]} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Account profile"
          style={[
            styles.avatar,
            narrow && styles.avatarSmall,
            compact && styles.avatarCompact,
          ]}
          onPress={() => router.push("/admin/profile")}
        >
          <Text style={[styles.avatarText, narrow && styles.avatarTextSmall]}>
            {(session?.user.name || "A").trim().charAt(0).toUpperCase()}
          </Text>
        </Pressable>
      </View>
      <View
        style={[
          styles.filters,
          narrow && styles.filtersSmall,
          compact && styles.filtersCompact,
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Choose company"
          style={[
            styles.filter,
            narrow && styles.filterSmall,
            compact && styles.filterCompact,
          ]}
          onPress={() => setModal("company")}
        >
          <View style={styles.filterContent}>
            <Text
              numberOfLines={1}
              style={[styles.filterLabel, narrow && styles.filterLabelSmall]}
            >
              COMPANY
            </Text>
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={[
                styles.filterValue,
                narrow && styles.filterValueSmall,
                compact && styles.filterValueCompact,
              ]}
            >
              {scope?.companyName ?? "Select company"}
            </Text>
          </View>
          <AppIcon name="chevron-down" size={14} color="#607591" style={styles.dropdownChevron} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Choose branch"
          style={[
            styles.filter,
            styles.branchFilter,
            narrow && styles.filterSmall,
            compact && styles.filterCompact,
          ]}
          onPress={() => setModal("branch")}
        >
          <View style={styles.filterContent}>
            <Text
              numberOfLines={1}
              style={[styles.filterLabel, narrow && styles.filterLabelSmall]}
            >
              BRANCH
            </Text>
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={[
                styles.filterValue,
                narrow && styles.filterValueSmall,
                compact && styles.filterValueCompact,
              ]}
            >
              {selectedBranch?.name ?? (branchId ? "Branch unavailable" : "All branches")}
            </Text>
          </View>
          <AppIcon name="chevron-down" size={14} color="#607591" style={styles.dropdownChevron} />
        </Pressable>
      </View>
      <Modal
        visible={modal !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setModal(null)}
      >
        <View style={[styles.overlay, narrow && styles.overlayBottom]}>
          <View style={[styles.sheet, narrow && styles.bottomSheet]}>
            <View style={styles.sheetHeading}>
              <Text style={[styles.heading, narrow && styles.headingSmall]}>
                {modal === "search"
                  ? "Search a module"
                  : modal === "branch"
                    ? "Choose branch"
                    : modal === "company"
                      ? "Choose company"
                      : "Switch business"}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                onPress={() => setModal(null)}
                style={styles.close}
              >
                <AppIcon symbol="×" style={styles.closeText} />
              </Pressable>
            </View>
            {modal === "search" ? (
              <SearchField
                value={search}
                onChangeText={setSearch}
                autoFocus
                accessibilityLabel="Search modules"
              />
            ) : (
              <Text style={styles.helper}>
                {modal === "branch"
                  ? "Branches available to your account appear here. The dashboard follows this selection."
                  : "Only businesses assigned to your account appear here."}
              </Text>
            )}
            <ScrollView
              keyboardShouldPersistTaps="handled"
              style={styles.scroll}
              contentContainerStyle={styles.options}
            >
              {modal === "search"
                ? results.map(({ label, href, icon, group }) => (
                    <Pressable
                      key={href}
                      accessibilityRole="button"
                      onPress={() => {
                        setModal(null);
                        router.push(href as import('expo-router').Href);
                      }}
                      style={styles.option}
                    >
                      <AppIcon symbol={icon} style={styles.optionIcon} />
                      <View style={{ flex: 1, minWidth: 0 }}><Text
                        style={[
                          styles.optionName,
                          narrow && styles.optionNameSmall,
                        ]}
                      >
                        {label}
                      </Text>
                      <Text style={styles.helper}>{group}</Text></View>
                      <AppIcon symbol="›" style={styles.chevron} />
                    </Pressable>
                  ))
                : null}
              {modal === "company" || modal === "business"
                ? companies.map((company) => (
                    <Pressable
                      accessibilityRole="button"
                      key={company.companyId}
                      onPress={() => switchTo(company.companyId, null)}
                      style={[
                        styles.option,
                        company.companyId === scope?.companyId &&
                          styles.selected,
                      ]}
                    >
                      <AppIcon symbol="▤" style={styles.optionIcon} />
                      <View style={styles.optionBody}>
                        <Text
                          style={[
                            styles.optionName,
                            narrow && styles.optionNameSmall,
                          ]}
                        >
                          {company.companyName}
                        </Text>
                        <Text style={styles.helper}>
                          {company.role.replace(/_/g, " ")} ·{" "}
                          {company.branches.length} accessible branch(es)
                        </Text>
                      </View>
                      <AppIcon symbol={company.companyId === scope?.companyId ? "✓" : "›"} style={styles.chevron} />
                    </Pressable>
                  ))
                : null}
              {modal === "branch" && active ? (
                <>
                  <BranchOptionsStatus
                    loading={branchesLoading}
                    error={branchesError}
                    empty={branches.length === 0}
                    onRetry={refreshBranches}
                  />
                  <Pressable
                    accessibilityRole="button"
                    disabled={branchesLoading || !!branchesError || branches.length === 0}
                    onPress={() => switchTo(active.companyId, null)}
                    style={[
                      styles.option,
                      branchId === null && styles.selected,
                    ]}
                  >
                    <AppIcon symbol="▤" style={styles.optionIcon} />
                    <Text
                      style={[
                        styles.optionName,
                        narrow && styles.optionNameSmall,
                      ]}
                    >
                      All branches
                    </Text>
                    <AppIcon symbol={branchId === null ? "✓" : "›"} style={styles.chevron} />
                  </Pressable>
                  {branches.map((branch) => (
                    <Pressable
                      accessibilityRole="button"
                      key={branch.id}
                      onPress={() => switchTo(active.companyId, branch.id)}
                      style={[
                        styles.option,
                        branchId === branch.id && styles.selected,
                      ]}
                    >
                      <Text style={styles.optionIcon}>
                        {branch.name.substring(0, 2).toUpperCase()}
                      </Text>
                      <Text
                        style={[
                          styles.optionName,
                          narrow && styles.optionNameSmall,
                        ]}
                      >
                        {branch.name}
                      </Text>
                      <AppIcon symbol={branchId === branch.id ? "✓" : "›"} style={styles.chevron} />
                    </Pressable>
                  ))}
                </>
              ) : null}
              {modal === "search" && results.length === 0 ? (
                <Text style={styles.helper}>No matching modules</Text>
              ) : null}
              {!!message && <Text style={styles.error}>{message}</Text>}
            </ScrollView>
            {modal === "branch" && ["BUSINESS_OWNER", "BUSINESS_ADMIN"].includes(scope?.role ?? "") && (
              <Pressable
                accessibilityRole="button"
                style={styles.manage}
                onPress={() => {
                  setModal(null);
                  router.push("/admin/branches");
                }}
              >
                <Text style={styles.manageText}>Manage branches</Text>
              </Pressable>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}
const baseStyles = StyleSheet.create({
  header: {
    height: 76,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 22,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerSmall: { height: 64, paddingHorizontal: 12, gap: 8 },
  headerCompact: { height: 60, paddingHorizontal: 10, gap: 6 },
  headerTablet: { height: 70, paddingHorizontal: 18, gap: 10 },
  titlePress: { flex: 1, minWidth: 0, minHeight: 44, justifyContent: "center" },
  title: { fontSize: 19, fontWeight: "700", color: "#16283e" },
  titleSmall: { fontSize: 16 },
  titleCompact: { fontSize: 14 },
  titleMedium: { fontSize: 15 },
  titleTablet: { fontSize: 18 },
  subtitle: { fontSize: 12, color: "#66778a", marginTop: 4 },
  subtitleSmall: { fontSize: 12, marginTop: 2 },
  subtitleCompact: { fontSize: 12 },
  searchButton: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: "#f3f6fb",
    justifyContent: "center",
    alignItems: "center",
  },
  searchButtonSmall: { width: 44, height: 44, borderRadius: 12 },
  searchButtonCompact: { width: 44, height: 44 },
  searchIcon: { fontSize: 30, color: "#16283e" },
  searchIconSmall: { fontSize: 24 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: "#e9efff",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarSmall: { width: 44, height: 44, borderRadius: 12 },
  avatarCompact: { width: 44, height: 44 },
  avatarText: { fontSize: 19, fontWeight: "700", color: "#315ac0" },
  avatarTextSmall: { fontSize: 16 },
  filters: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 22,
    paddingVertical: 12,
    backgroundColor: "#fff",
  },
  filtersSmall: { paddingHorizontal: 12, gap: 8, paddingVertical: 9 },
  filtersCompact: { paddingHorizontal: 9, gap: 6, paddingVertical: 8 },
  filter: {
    flex: 1,
    minWidth: 0,
    minHeight: 47,
    backgroundColor: "#f7f9fc",
    borderColor: "#dee5ed",
    borderWidth: 1,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 4,
  },
  branchFilter: { backgroundColor: "#eaf0ff", borderColor: "#cbd8f1" },
  filterSmall: { minHeight: 56, paddingHorizontal: 9 },
  filterCompact: { minHeight: 53, paddingHorizontal: 7 },
  filterContent: { flex: 1, minWidth: 0, justifyContent: "center", gap: 3 },
  dropdownChevron: { flexShrink: 0, marginLeft: 2 },
  filterLabel: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.5,
    color: "#7a8795",
  },
  filterLabelSmall: { fontSize: 10, letterSpacing: 0.3 },
  filterText: { fontSize: 13, color: "#7a8795", flex: 1 },
  filterValue: { fontSize: 12, fontWeight: "700", color: "#1b2c44" },
  filterValueSmall: { fontSize: 12 },
  filterValueCompact: { fontSize: 12 },
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(21,36,60,0.33)",
    padding: 22,
  },
  overlayBottom: { justifyContent: "flex-end", padding: 0 },
  sheet: {
    backgroundColor: "#fff",
    borderRadius: 25,
    width: "100%",
    maxWidth: 580,
    maxHeight: "85%",
    padding: 22,
  },
  bottomSheet: {
    maxWidth: "100%",
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    maxHeight: "83%",
    padding: 20,
  },
  sheetHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 12,
  },
  heading: { fontSize: 22, fontWeight: "700", color: "#172c43", flex: 1 },
  headingSmall: { fontSize: 19 },
  close: {
    width: 44,
    height: 44,
    backgroundColor: "#f4f6fb",
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: { fontSize: 28, color: colors.text },
  helper: { color: "#778596", fontSize: 12, lineHeight: 18, marginBottom: 12 },
  scroll: { minHeight: 0 },
  options: { gap: 10, paddingBottom: 12 },
  option: {
    minHeight: 66,
    borderWidth: 1,
    borderColor: "#e0e6ef",
    borderRadius: 17,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  selected: { backgroundColor: colors.primaryLight, borderColor: "#cbd7f2" },
  optionIcon: {
    minWidth: 40,
    height: 40,
    textAlign: "center",
    textAlignVertical: "center",
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
    fontSize: 19,
    color: colors.primaryDark,
    overflow: "hidden",
  },
  optionBody: { flex: 1 },
  optionName: { flex: 1, fontSize: 16, fontWeight: "700", color: colors.text },
  optionNameSmall: { fontSize: 14 },
  chevron: { fontSize: 22, color: "#62758b" },
  searchInput: {
    borderWidth: 1,
    borderColor: "#dce3e9",
    borderRadius: 14,
    paddingHorizontal: 14,
    minHeight: 49,
    marginBottom: 16,
    fontSize: 15,
  },
  error: { color: "#b13e42", fontSize: 13 },
  manage: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dbe3ec",
    padding: 15,
    alignItems: "center",
    marginTop: 10,
  },
  manageText: { fontWeight: "700", color: "#233c56" },
});
