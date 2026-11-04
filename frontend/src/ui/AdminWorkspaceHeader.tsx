import { useToastState } from "./useToastState";
import { WorkspaceSearchDialog } from "./WorkspaceSearchDialog";
import { KeyboardAwareScrollView as ScrollView } from "./KeyboardAwareScrollView";
import { FloatingTextInput as TextInput } from "./FloatingTextInput";
import { AppIcon } from "./AppIcon";
import { Dropdown } from "./Dropdown";
import { BrandLogo } from "./BrandLogo";
import { useDesktopStyles } from "./useDesktopStyles";
import React, { useEffect, useMemo, useState } from "react";
import {
  Platform,
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { ToastModal as Modal } from "./Toast";
import { useRouter } from "expo-router";
import { useAuth } from "../core/auth/AuthProvider";
import { roleLabels } from "../core/admin/role-capabilities";
import { useAvailableBranches } from "../core/admin/available-branches";
import { BranchOptionsStatus } from "./BranchOptionsStatus";
import { colors } from "../shared/theme/colors";
import { RESPONSIVE_BREAKPOINTS } from "./responsiveBreakpoints";
import { webWorkspaceStyles, webWorkspaceTheme } from "./webWorkspaceStyles";
import {
  getAdminDestinations,
  filterDestinations,
} from "./workspace-navigation";
import {
  useAdminScope,
  selectAdminWorkspace,
  selectAdminBranch,
  getSelectedBranchId,
} from "../core/admin/scope";

const ADMIN = [
  "BUSINESS_OWNER",
  "BUSINESS_ADMIN",
  "COMPANY_MANAGER",
  "BRANCH_MANAGER",
  "SALES_MANAGER",
  "HR_MANAGER",
  "PAYROLL_MANAGER",
];
export function AdminWorkspaceHeader({
  onOpenNavigation,
}: {
  onOpenNavigation?: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const shortScreen =
    (Platform.OS === "web" ? height : Dimensions.get("screen").height) < 500;
  const desktop =
    Platform.OS === "web" && width >= RESPONSIVE_BREAKPOINTS.desktop;
  const densityStyles = useDesktopStyles(baseStyles);
  const styles = useMemo(
    () =>
      desktop
        ? {
            ...densityStyles,
            header: { ...densityStyles.header, height: 64 },
            title: { ...densityStyles.title, fontSize: 17, lineHeight: 23 },
            subtitle: {
              ...densityStyles.subtitle,
              fontSize: 12,
              lineHeight: 18,
              marginTop: 2,
            },
            option: {
              ...densityStyles.option,
              minHeight: 54,
              padding: 10,
              borderRadius: 10,
            },
            optionName: {
              ...densityStyles.optionName,
              fontSize: 14,
              lineHeight: 20,
            },
            heading: { ...densityStyles.heading, fontSize: 19, lineHeight: 25 },
          }
        : densityStyles,
    [densityStyles, desktop],
  );
  const narrow = width < RESPONSIVE_BREAKPOINTS.tablet;
  const compact = width < 390;
  const medium = width >= 390 && width < RESPONSIVE_BREAKPOINTS.tablet;
  const tablet =
    width >= RESPONSIVE_BREAKPOINTS.tablet &&
    width < RESPONSIVE_BREAKPOINTS.desktop;
  const { session } = useAuth();
  const scope = useAdminScope();
  const router = useRouter();
  const [modal, setModal] = useState<"business" | "search" | null>(null);
  const [search, setSearch] = useState("");
  const [businessSearch, setBusinessSearch] = useState("");
  const [message, setMessage] = useToastState("", "error");
  const memberships = useMemo(
    () =>
      (session?.memberships ?? []).filter((m) => {
        const roles = m.roles ?? [m.role];
        return (
          roles.some((role) => ADMIN.includes(role)) &&
          (m.branches.length > 0 ||
            roles.some((role) =>
              ["BUSINESS_OWNER", "BUSINESS_ADMIN"].includes(role),
            ))
        );
      }),
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
  const visibleCompanies = useMemo(() => {
    const query = businessSearch.trim().toLocaleLowerCase();
    return companies
      .filter(
        (company) =>
          !query ||
          `${company.companyName} ${company.role}`
            .toLocaleLowerCase()
            .includes(query),
      )
      .sort(
        (a, b) =>
          Number(b.companyId === scope?.companyId) -
          Number(a.companyId === scope?.companyId),
      );
  }, [businessSearch, companies, scope?.companyId]);
  const {
    branches,
    loading: branchesLoading,
    error: branchesError,
    refresh: refreshBranches,
  } = useAvailableBranches(active?.companyId);
  const branchId = scope?.branchId ?? null;
  const selectedBranch =
    branches.find((b) => b.id === branchId) ??
    (branchesLoading
      ? scope?.branches.find((b) => b.id === branchId)
      : undefined);
  const results = filterDestinations(
    getAdminDestinations(session, scope?.companyId),
    search,
  );
  useEffect(() => {
    if (modal) setMessage("");
  }, [modal]);
  const switchTo = async (companyId: string, nextBranchId: string | null) => {
    try {
      const currentMemberships = memberships.map((membership) =>
        membership.companyId === active?.companyId &&
        !branchesLoading &&
        !branchesError
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
  const chooseBranch = async (nextBranchId: string) => {
    try {
      await selectAdminBranch(nextBranchId || null);
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Workspace selection failed.",
      );
    }
  };
  const branchOptions = [
    { value: "", label: "All branches" },
    ...branches.map((branch) => ({ value: branch.id, label: branch.name })),
    ...(branchId &&
    selectedBranch &&
    !branches.some((branch) => branch.id === branchId)
      ? [{ value: selectedBranch.id, label: selectedBranch.name }]
      : []),
  ];
  return (
    <>
      <View
        testID="workspace-header-main"
        style={[
          styles.header,
          narrow && styles.headerSmall,
          compact && styles.headerCompact,
          tablet && styles.headerTablet,
          {
            height: undefined,
            minHeight: shortScreen
              ? 52
              : desktop
                ? 64
                : compact
                  ? 60
                  : tablet
                    ? 70
                    : 64,
            paddingVertical: shortScreen ? 4 : 8,
          },
        ]}
      >
        {onOpenNavigation && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open navigation"
            onPress={onOpenNavigation}
            style={{
              width: 44,
              minHeight: 44,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 9,
              backgroundColor: colors.primaryLight,
            }}
          >
            <AppIcon name="menu" size={20} color={colors.primary} />
          </Pressable>
        )}
        {!desktop && <BrandLogo size={compact ? 28 : 32} />}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Switch business"
          nativeID="workspace-company-selector"
          onPress={() => {
            setBusinessSearch("");
            setModal("business");
          }}
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
            {scope?.role
              ? (roleLabels[scope.role] ?? "Staff workspace")
              : "Business workspace"}
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
          <AppIcon
            symbol="⌕"
            style={[styles.searchIcon, narrow && styles.searchIconSmall]}
          />
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
        testID="workspace-header-filters"
        style={[
          styles.filters,
          narrow && styles.filtersSmall,
          compact && styles.filtersCompact,
          shortScreen && { paddingVertical: 4 },
        ]}
      >
        <Dropdown
          label="Company"
          labelInside
          controlId="workspace-company-dropdown"
          quiet
          value={scope?.companyId ?? ""}
          options={companies.map((company) => ({
            value: company.companyId,
            label: company.companyName,
          }))}
          placeholder="Select company"
          onChange={(companyId) => switchTo(companyId, null)}
          overlayMenu
          style={{ flex: 1, minWidth: 0 }}
        />
        <Dropdown
          label="Branch"
          labelInside
          controlId="workspace-branch-dropdown"
          quiet
          value={branchId ?? ""}
          options={branchOptions}
          placeholder={branchId ? "Branch unavailable" : "All branches"}
          disabled={branchesLoading || !!branchesError || branches.length === 0}
          emptyText={branchesError || "No branches available."}
          onChange={chooseBranch}
          overlayMenu
          style={{ flex: 1, minWidth: 0 }}
        />
      </View>
      {!!branchesError && (
        <View style={{ paddingHorizontal: narrow ? 12 : 22 }}>
          <BranchOptionsStatus
            loading={branchesLoading}
            error={branchesError}
            empty={branches.length === 0}
            onRetry={refreshBranches}
          />
        </View>
      )}
      <WorkspaceSearchDialog
        visible={modal === "search"}
        query={search}
        onChangeQuery={setSearch}
        results={results}
        onClose={() => setModal(null)}
        onSelect={(item) => {
          setModal(null);
          router.push(item.href as import("expo-router").Href);
        }}
      />
      <Modal
        visible={modal !== null && modal !== "search"}
        transparent
        animationType="fade"
        onRequestClose={() => setModal(null)}
      >
        <View style={[styles.overlay, narrow && styles.overlayBottom]}>
          <View
            accessibilityViewIsModal
            style={[styles.sheet, narrow && styles.bottomSheet]}
          >
            <View style={styles.sheetHeading}>
              <Text style={[styles.heading, narrow && styles.headingSmall]}>
                Switch business
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
            <Text style={styles.sheetIntro}>
              Choose a business workspace to continue. Your access and branch
              options update with your selection.
            </Text>
            {companies.length > 4 && (
              <TextInput
                clearOnSubmit={false}
                accessibilityLabel="Search businesses"
                value={businessSearch}
                onChangeText={setBusinessSearch}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                style={styles.businessSearch}
              />
            )}
            <ScrollView
              keyboardShouldPersistTaps="handled"
              style={styles.scroll}
              contentContainerStyle={styles.options}
            >
              {modal === "business"
                ? visibleCompanies.map((company) => (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Select ${company.companyName}`}
                      accessibilityState={{
                        selected: company.companyId === scope?.companyId,
                      }}
                      key={company.companyId}
                      onPress={() => switchTo(company.companyId, null)}
                      style={({ pressed }) => [
                        styles.option,
                        company.companyId === scope?.companyId &&
                          styles.selected,
                        pressed && styles.optionPressed,
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
                        <Text style={[styles.helper, styles.optionMeta]}>
                          {company.role.replace(/_/g, " ")} ·{" "}
                          {company.branches.length} accessible{" "}
                          {company.branches.length === 1
                            ? "branch"
                            : "branches"}
                        </Text>
                      </View>
                      <AppIcon
                        symbol={
                          company.companyId === scope?.companyId ? "✓" : "›"
                        }
                        style={styles.chevron}
                      />
                    </Pressable>
                  ))
                : null}
              {modal === "business" && companies.length === 0 && (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyTitle}>
                    No business workspaces available
                  </Text>
                  <Text style={styles.emptyCopy}>
                    Ask your administrator to add workspace access to your
                    account.
                  </Text>
                </View>
              )}
              {modal === "business" &&
                companies.length > 0 &&
                visibleCompanies.length === 0 && (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyTitle}>
                      No matching businesses
                    </Text>
                    <Text style={styles.emptyCopy}>
                      Try another name or clear your search.
                    </Text>
                  </View>
                )}
              {!!message && <Text style={styles.error}>{message}</Text>}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}
const web = Platform.OS === "web";
const baseStyles = webWorkspaceStyles(
  StyleSheet.create({
    header: {
      height: 76,
      backgroundColor: web ? webWorkspaceTheme.surface : colors.surface,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 22,
      gap: 12,
      borderBottomWidth: 1,
      borderBottomColor: web ? webWorkspaceTheme.border : colors.border,
    },
    headerSmall: { height: 64, paddingHorizontal: 12, gap: 8 },
    headerCompact: { height: 60, paddingHorizontal: 10, gap: 6 },
    headerTablet: { height: 70, paddingHorizontal: 18, gap: 10 },
    titlePress: {
      flex: 1,
      minWidth: 0,
      minHeight: 44,
      justifyContent: "center",
    },
    title: {
      fontSize: 19,
      fontWeight: "700",
      color: web ? webWorkspaceTheme.text : "#16283e",
    },
    titleSmall: { fontSize: 16 },
    titleCompact: { fontSize: 14 },
    titleMedium: { fontSize: 15 },
    titleTablet: { fontSize: 18 },
    subtitle: {
      fontSize: 12,
      color: web ? webWorkspaceTheme.muted : "#66778a",
      marginTop: 4,
    },
    subtitleSmall: { fontSize: 12, marginTop: 2 },
    subtitleCompact: { fontSize: 12 },
    searchButton: {
      width: 44,
      height: 44,
      borderRadius: web ? webWorkspaceTheme.radiusControl : 15,
      backgroundColor: web ? webWorkspaceTheme.hover : "#f3f6fb",
      justifyContent: "center",
      alignItems: "center",
    },
    searchButtonSmall: { width: 44, height: 44, borderRadius: 12 },
    searchButtonCompact: { width: 44, height: 44 },
    searchIcon: {
      fontSize: 30,
      color: web ? webWorkspaceTheme.text : "#16283e",
    },
    searchIconSmall: { fontSize: 24 },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: web ? webWorkspaceTheme.radiusControl : 16,
      backgroundColor: "#e9efff",
      alignItems: "center",
      justifyContent: "center",
    },
    avatarSmall: { width: 44, height: 44, borderRadius: 12 },
    avatarCompact: { width: 44, height: 44 },
    avatarText: {
      fontSize: 19,
      fontWeight: "700",
      color: web ? webWorkspaceTheme.primary : "#315ac0",
    },
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
      borderRadius: web ? webWorkspaceTheme.radiusCard : 25,
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
    heading: {
      fontSize: 22,
      fontWeight: "700",
      color: web ? webWorkspaceTheme.text : "#172c43",
      flex: 1,
    },
    headingSmall: { fontSize: 19 },
    close: {
      width: 44,
      height: 44,
      backgroundColor: web ? webWorkspaceTheme.hover : "#f4f6fb",
      borderRadius: web ? webWorkspaceTheme.radiusControl : 15,
      alignItems: "center",
      justifyContent: "center",
    },
    closeText: { fontSize: 28, color: colors.text },
    helper: {
      color: web ? webWorkspaceTheme.muted : "#778596",
      fontSize: 12,
      lineHeight: 18,
      marginBottom: 12,
    },
    sheetIntro: {
      color: web ? webWorkspaceTheme.muted : "#66778a",
      fontSize: 13,
      lineHeight: 19,
      marginBottom: 16,
    },
    businessSearch: {
      borderWidth: 1,
      borderColor: "#dce3ed",
      borderRadius: 12,
      minHeight: 48,
      paddingHorizontal: 14,
      marginBottom: 14,
      color: colors.text,
      fontSize: 14,
    },
    scroll: { minHeight: 0 },
    options: { gap: 10, paddingBottom: 12, flexGrow: 1 },
    option: {
      minHeight: 76,
      borderWidth: 1,
      borderColor: web ? webWorkspaceTheme.border : "#e0e6ef",
      borderRadius: web ? webWorkspaceTheme.radiusControl : 17,
      padding: 13,
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
    },
    optionPressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
    selected: {
      backgroundColor: web
        ? webWorkspaceTheme.primaryLight
        : colors.primaryLight,
      borderColor: web ? webWorkspaceTheme.primary : "#cbd7f2",
    },
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
    optionBody: { flex: 1, alignItems: "flex-start", justifyContent: "center" },
    optionName: {
      flex: 1,
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
      textAlign: "left",
    },
    optionNameSmall: { fontSize: 14 },
    optionMeta: { textAlign: "left", marginBottom: 0 },
    emptyState: {
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 24,
      paddingVertical: 32,
      gap: 8,
    },
    emptyTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.text,
      textAlign: "center",
    },
    emptyCopy: {
      fontSize: 13,
      lineHeight: 19,
      color: "#718096",
      textAlign: "center",
    },
    chevron: { fontSize: 22, color: "#62758b" },
    searchInput: {
      borderWidth: 1,
      borderColor: web ? webWorkspaceTheme.border : "#dce3e9",
      borderRadius: web ? webWorkspaceTheme.radiusControl : 14,
      paddingHorizontal: 14,
      minHeight: web ? webWorkspaceTheme.controlHeight : 49,
      marginBottom: 16,
      fontSize: 15,
    },
    error: { color: "#b13e42", fontSize: 13 },
  }),
);
