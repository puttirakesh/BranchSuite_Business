import { canManageEmployees } from '../../../src/core/admin/role-capabilities';
import { isInBranch } from '../../../src/core/admin/branch-filter';
import { useToastState } from '../../../src/ui/useToastState';
import { SearchField } from "../../../src/ui/SearchField";
import {
  SummaryMetrics,
  type SummaryMetric,
} from "../../../src/ui/SummaryMetrics";
import { FloatingTextInput as TextInput } from "../../../src/ui/FloatingTextInput";
import { AppIcon } from "../../../src/ui/AppIcon";
import { AdminPageHeading, useWebSectionHeader } from "../../../src/ui/AdminPageHeading";
import { Dropdown } from "../../../src/ui/Dropdown";
import { BranchOptionsStatus } from "../../../src/ui/BranchOptionsStatus";
import { useAvailableBranches } from "../../../src/core/admin/available-branches";
import { AdminBottomNavigation } from "../../../src/ui/AdminBottomNavigation";
import { useAdminLayout } from "../../../src/ui/useAdminLayout";
import React, { useEffect, useCallback, useRef, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useWorkspaceFocusEffect as useFocusEffect } from '../../../src/core/admin/useWorkspaceFocusEffect';
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  getEmployees,
  type Employee,
} from "../../../src/core/employees";
import { selectAdminBranch, useAdminScope } from "../../../src/core/admin/scope";

const filters = [
  "All",
  "Active",
  "Inactive",
  "Login enabled",
  "No login",
] as const;
type Filter = (typeof filters)[number];
const pageSize = 12;
const isActive = (employee: Employee) => employee.status !== "inactive";
const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();

export default function EmployeesPage({
  defaultFilter = "Active",
}: {
  defaultFilter?: Filter;
}) {
  const webHeader = useWebSectionHeader();
  const scope = useAdminScope();
  const { styles, columns, columnWrapperStyle } = useAdminLayout(
    baseStyles,
    "list",
  );
  const router = useRouter();
  const { added, filter: requestedFilter } = useLocalSearchParams<{
    added?: string;
    filter?: string;
  }>();
  const initialFilter =
    filters.find(
      (value) => value.toLowerCase() === requestedFilter?.toLowerCase(),
    ) || defaultFilter;
  const searchRef = useRef<TextInput>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useToastState("", 'error');
  const [attempt, setAttempt] = useState(0);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [branch, setBranch] = useState("");
  const [page, setPage] = useState(0);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setError("");
      setFilter(initialFilter);
      getEmployees()
        .then((records) => {
          if (active) {
            setEmployees(records);
            setPage(0);
          }
        })
        .catch(() => {
          if (active) setError("Could not load employees. Please try again.");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [attempt, initialFilter]),
  );

  const {
    branches: availableBranches,
    loading: branchesLoading,
    error: branchesError,
    refresh: refreshBranches,
  } = useAvailableBranches();
  const branches = availableBranches.map((item) => item.name);
  useEffect(() => {
    const selectedName = scope?.branchId
      ? availableBranches.find((item) => item.id === scope.branchId)?.name ?? ""
      : "";
    setBranch(selectedName);
    setPage(0);
  }, [scope?.branchId, availableBranches]);
  useEffect(() => {
    if (
      !branchesLoading &&
      !branchesError &&
      branch &&
      !availableBranches.some((item) => item.name === branch)
    )
      setBranch("");
  }, [availableBranches, branchesLoading, branchesError, branch]);
  const branchOptions = [{ value: "", label: "All branches" }, ...branches.map((name) => ({ value: name, label: name }))];
  const chooseBranch = (value: string) => {
    setBranch(value);
    void selectAdminBranch(availableBranches.find((item) => item.name === value)?.id ?? null);
    setPage(0);
  };
  const scoped = employees.filter(
    (employee) => isInBranch(employee, scope?.branchId, branch),
  );
  const query = search.trim().toLowerCase();
  const filtered = scoped.filter((employee) => {
    const matchesSearch = [
      employee.fullName,
      employee.email,
      employee.branch,
      employee.employeeCode ?? "",
      employee.department,
    ].some((value) => value.toLowerCase().includes(query));
    const matchesFilter =
      filter === "All" ||
      (filter === "Active" && isActive(employee)) ||
      (filter === "Inactive" && !isActive(employee)) ||
      (filter === "Login enabled" && employee.loginEnabled === true) ||
      (filter === "No login" && employee.loginEnabled !== true);
    return matchesSearch && matchesFilter;
  });
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(filtered.length / pageSize) - 1),
  );
  const start = currentPage * pageSize;
  const pageEmployees = filtered.slice(start, start + pageSize);
  const summary: SummaryMetric[] = [
    {
      id: "all",
      label: "Total employees",
      value: scoped.length,
      icon: "users",
      selected: filter === "All",
      onPress: () => {
        setFilter("All");
        setPage(0);
      },
    },
    {
      id: "active",
      label: "Active employees",
      value: scoped.filter(isActive).length,
      icon: "user-check",
      tone: "success",
      selected: filter === "Active",
      onPress: () => {
        setFilter("Active");
        setPage(0);
      },
    },
    {
      id: "login",
      label: "Login enabled",
      value: scoped.filter((employee) => employee.loginEnabled === true).length,
      icon: "log-in",
      selected: filter === "Login enabled",
      onPress: () => {
        setFilter("Login enabled");
        setPage(0);
      },
    },
  ];

  const listHeader = (
    <View>
      <AdminPageHeading title="Employees" branch={{ value: branch || "All branches", label: "Choose branch", onPress: () => {} }} branchControl={<Dropdown valueOnly label="Branch" placeholder="Select a branch" value={branch} options={branchOptions} onChange={chooseBranch} style={styles.headerSelect} />} onRefresh={() => setAttempt(value => value + 1)} refreshing={loading}>
        {canManageEmployees(scope?.roles ?? [scope?.role ?? '']) && <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/admin/employees/create")}
          style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
        >
          <Text style={styles.addText}>Add employee</Text>
        </Pressable>}
      </AdminPageHeading>
      {!webHeader && <View
        accessibilityLabel="Page filters"
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 12,
          marginVertical: 12,
        }}
      >
        <Dropdown valueOnly label="Branch" placeholder="Select a branch" value={branch} options={branchOptions} onChange={chooseBranch} style={styles.mobileSelect} />
      </View>}
      <BranchOptionsStatus loading={branchesLoading} error={branchesError} empty={branches.length === 0} onRetry={refreshBranches} />

      {!loading &&
        !error &&
        added &&
        employees.some((employee) => employee.id === added) && (
          <Text accessibilityLiveRegion="polite" style={styles.success}>
            Employee added successfully.
          </Text>
        )}
      <SummaryMetrics
        testID="employee-summary"
        title="Employee overview"
        caption={`${branch || "All branches"} · Tap a total to filter. Counts are before search.`}
        compact
        items={summary}
        loading={loading}
        unavailable={!!error}
      />
      <SearchField
        ref={searchRef}
        accessibilityLabel="Search employees"
        value={search}
        onChangeText={(value) => {
          setSearch(value);
          setPage(0);
        }}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterTabs}
      >
        {filters.map((label) => (
          <Pressable
            key={label}
            accessibilityRole="tab"
            aria-selected={filter === label}
            accessibilityState={{ selected: filter === label }}
            onPress={() => {
              setFilter(label);
              setPage(0);
            }}
            style={[
              styles.filterTab,
              filter === label && styles.selectedFilter,
            ]}
          >
            <Text
              style={[
                styles.filterText,
                filter === label && styles.selectedText,
              ]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      {!loading && !error && (
        <Text accessibilityLiveRegion="polite" style={styles.resultCount}>
          {filtered.length} {filtered.length === 1 ? "employee" : "employees"}
          {filtered.length > 0
            ? ` · showing ${start + 1}–${start + pageEmployees.length}`
            : ""}
        </Text>
      )}
    </View>
  );

  return (
    <SafeAreaView edges={["left", "right"]} style={styles.safe}>
      <View style={styles.page}>
        <FlatList
          testID="employee-list"
          key={columns}
          numColumns={columns}
          columnWrapperStyle={columns > 1 ? columnWrapperStyle : undefined}
          data={loading || error ? [] : pageEmployees}
          keyExtractor={(employee) => employee.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator
                accessibilityLabel="Loading employees"
                color="#345cf2"
                style={styles.loading}
              />
            ) : error ? (
              <View style={styles.empty}>
                <Text style={styles.error}>{error}</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setAttempt((value) => value + 1)}
                  style={styles.retryButton}
                >
                  <Text style={styles.retryText}>Retry</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>
                  {employees.length === 0
                    ? "No employees yet"
                    : "No matching employees"}
                </Text>
                <Text style={styles.subtitle}>
                  {employees.length === 0
                    ? "Add your first employee to get started."
                    : "Try another search, branch or filter."}
                </Text>
              </View>
            )
          }
          renderItem={({ item, index }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`View ${item.fullName}`}
              onPress={() => router.push({ pathname: "/admin/employees/[id]", params: { id: item.profileId ?? item.id } })}
              style={({ pressed }) => [
                styles.card,
                styles.listItem,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.cardBody}>
                <View style={styles.between}>
                  <View
                    style={[
                      styles.avatar,
                      index % 2 === 1 && styles.greenAvatar,
                    ]}
                  >
                    <Text
                      style={[
                        styles.initial,
                        index % 2 === 1 && styles.greenInitial,
                      ]}
                    >
                      {initials(item.fullName)}
                    </Text>
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.name}>{item.fullName}</Text>
                    <Text style={styles.description}>
                      {item.department || item.jobTitle || item.email}
                    </Text>
                  </View>
                  <AppIcon symbol="›" style={styles.chevron} />
                </View>
                <View style={styles.cardMeta}>
                  <Text style={styles.branchName}>{item.branch}</Text>
                  <View
                    style={[
                      styles.status,
                      !isActive(item) && styles.inactiveStatus,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        !isActive(item) && styles.inactiveText,
                      ]}
                    >
                      {isActive(item) ? "Active" : "Inactive"}
                    </Text>
                  </View>
                </View>
              </View>
              <View style={styles.cardFooter}>
                <View style={styles.lockIcon}>
                  <View
                    style={[
                      styles.lockShackle,
                      item.loginEnabled && styles.enabledLock,
                    ]}
                  />
                  <View
                    style={[
                      styles.lockBody,
                      item.loginEnabled && styles.enabledLock,
                    ]}
                  />
                </View>
                <Text style={styles.loginText}>
                  {item.loginEnabled
                    ? "Employee login enabled"
                    : "Employee login not enabled"}
                </Text>
              </View>
            </Pressable>
          )}
          ListFooterComponent={
            !loading && !error && filtered.length > pageSize ? (
              <View style={styles.pagination}>
                <Pressable
                  accessibilityRole="button"
                  disabled={currentPage === 0}
                  onPress={() => setPage(currentPage - 1)}
                  style={[
                    styles.pageButton,
                    currentPage === 0 && styles.disabled,
                  ]}
                >
                  <Text style={styles.retryText}>Previous</Text>
                </Pressable>
                <Text style={styles.pageCount}>
                  {currentPage + 1} / {Math.ceil(filtered.length / pageSize)}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  disabled={start + pageSize >= filtered.length}
                  onPress={() => setPage(currentPage + 1)}
                  style={[
                    styles.pageButton,
                    start + pageSize >= filtered.length && styles.disabled,
                  ]}
                >
                  <Text style={styles.retryText}>Next</Text>
                </Pressable>
              </View>
            ) : null
          }
        />

        <AdminBottomNavigation />
      </View>


    </SafeAreaView>
  );
}

const baseStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f6f8fd" },
  page: { flex: 1, width: "100%", maxWidth: 560, alignSelf: "center" },
  flex: { flex: 1 },
  between: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  header: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e4eaf5",
  },
  companyName: {
    minHeight: 18,
    fontSize: 14,
    fontWeight: "800",
    color: "#20334f",
  },
  headerCaption: { fontSize: 10, color: "#8794aa", marginTop: 4 },
  headerSearch: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f5f7fc",
  },
  headerSearchGlyph: { fontSize: 26, color: "#304560" },
  headerAvatar: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "#eaf0ff",
  },
  headerFilters: { flexDirection: "row", gap: 8, marginTop: 14 },
  companyFilter: {
    flex: 1,
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#e4eaf7",
    backgroundColor: "#f7f9ff",
    borderRadius: 9,
    paddingHorizontal: 10,
  },
  headerSelect: { width: 180 },
  mobileSelect: { flex: 1, minWidth: 0 },
  chevron: { fontSize: 20, color: "#8798b1" },
  list: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24, gap: 12 },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 22,
    marginBottom: 22,
  },
  title: {
    fontSize: 25,
    fontWeight: "800",
    color: "#20334f",
    letterSpacing: -0.7,
  },
  subtitle: { fontSize: 11, lineHeight: 18, color: "#7a8ba5", marginTop: 5 },
  addButton: {
    minHeight: 42,
    paddingHorizontal: 13,
    borderRadius: 13,
    justifyContent: "center",
    backgroundColor: "#345cf2",
  },
  addText: { fontSize: 11, fontWeight: "700", color: "#fff" },
  pressed: { opacity: 0.8 },
  success: {
    fontSize: 12,
    color: "#428671",
    backgroundColor: "#e6f4ee",
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  summary: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e4eaf5",
    borderRadius: 16,
    paddingVertical: 18,
    marginBottom: 16,
  },
  summaryItem: {
    flex: 1,
    paddingHorizontal: 14,
    alignItems: "flex-start",
    justifyContent: "center",
    paddingVertical: 16,
    minWidth: 0,
  },
  summaryDivider: { borderLeftWidth: 1, borderLeftColor: "#f0f3f9" },
  summaryValue: {
    fontSize: 23,
    fontWeight: "800",
    color: "#304968",
    textAlign: "left",
    flexShrink: 1,
  },
  summaryLabel: {
    fontSize: 9,
    color: "#71849f",
    marginTop: 5,
    textAlign: "left",
    flexShrink: 1,
  },
  searchField: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e1e8f4",
    backgroundColor: "#fff",
    borderRadius: 13,
    paddingHorizontal: 13,
    minHeight: 46,
  },
  searchFieldGlyph: { fontSize: 22, color: "#7a8ba5", marginRight: 9 },
  searchInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 12,
    fontSize: 13,
    color: "#20334f",
  },
  clearSearch: {
    width: 30,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  clearText: { fontSize: 25, color: "#8794aa" },
  filterTabs: { gap: 7, paddingTop: 14, paddingBottom: 5 },
  filterTab: {
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#e4eaf5",
    backgroundColor: "#fff",
    borderRadius: 12,
  },
  selectedFilter: { borderColor: "#d5dfff", backgroundColor: "#eaf0ff" },
  filterText: { fontSize: 10, fontWeight: "600", color: "#405573" },
  selectedText: { color: "#345cf2" },
  resultCount: {
    fontSize: 10,
    color: "#8192ad",
    marginTop: 16,
    marginBottom: 3,
  },
  loading: { marginTop: 25 },
  empty: { backgroundColor: "#fff", padding: 22, borderRadius: 16 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#20334f" },
  error: { color: "#b94d61", fontSize: 13 },
  retryButton: {
    minHeight: 44,
    justifyContent: "center",
    alignSelf: "flex-start",
    marginTop: 6,
  },
  retryText: { color: "#345cf2", fontSize: 12, fontWeight: "600" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#e0e8f5",
    overflow: "hidden",
  },
  cardBody: { padding: 16 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eaf0ff",
    borderWidth: 1,
    borderColor: "#dfe7ff",
  },
  initial: { color: "#345cf2", fontWeight: "700", fontSize: 12 },
  greenAvatar: { backgroundColor: "#e5f4ee", borderColor: "#d5eee4" },
  greenInitial: { color: "#388d76" },
  name: { fontSize: 13, fontWeight: "700", color: "#20334f" },
  description: { fontSize: 10, lineHeight: 16, color: "#71849f", marginTop: 3 },
  cardMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 16,
  },
  branchName: { flex: 1, fontSize: 10, color: "#8192ad" },
  status: {
    borderRadius: 7,
    backgroundColor: "#e1f3eb",
    paddingVertical: 5,
    paddingHorizontal: 9,
  },
  statusText: { fontSize: 9, fontWeight: "600", color: "#34856c" },
  inactiveStatus: { backgroundColor: "#f0f2f7" },
  inactiveText: { color: "#8994a7" },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderTopWidth: 1,
    borderTopColor: "#edf1f8",
    backgroundColor: "#fafbff",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  lockIcon: { width: 10, height: 12, alignItems: "center" },
  lockShackle: {
    width: 6,
    height: 6,
    borderWidth: 1,
    borderColor: "#8a9bb3",
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  lockBody: {
    width: 9,
    height: 7,
    marginTop: -1,
    borderWidth: 1,
    borderColor: "#8a9bb3",
    borderRadius: 1,
    backgroundColor: "#fafbff",
  },
  enabledLock: { borderColor: "#388d76" },
  loginText: { fontSize: 9, color: "#7b8da8" },
  pagination: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  pageButton: {
    minHeight: 44,
    paddingHorizontal: 12,
    justifyContent: "center",
    backgroundColor: "#fff",
    borderRadius: 10,
  },
  disabled: { opacity: 0.4 },
  pageCount: { fontSize: 11, color: "#8192ad" },
  navigation: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e4eaf5",
    paddingTop: 8,
    paddingBottom: 8,
  },
  navItem: { flex: 1, alignItems: "center", gap: 3 },
  navIcon: {
    minWidth: 46,
    height: 32,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  selectedNav: { backgroundColor: "#eaf0ff" },
  navGlyph: { fontSize: 22, color: "#71829c" },
  navLabel: { fontSize: 9, color: "#71829c" },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(27, 43, 68, 0.3)",
    padding: 24,
    justifyContent: "center",
  },
  modal: {
    width: "100%",
    maxWidth: 460,
    maxHeight: "85%",
    alignSelf: "center",
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 22,
  },
  modalTitle: { flex: 1, fontSize: 20, fontWeight: "800", color: "#20334f" },
  closeButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  detailField: { paddingVertical: 10 },
  detailValue: { fontSize: 13, color: "#405573", marginTop: 6 },
  statusActions: {
    borderTopWidth: 1,
    borderTopColor: "#edf1f8",
    paddingTop: 14,
    gap: 12,
  },
  statusNotice: { fontSize: 12, color: "#34856c" },
  statusButton: {
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: "#345cf2",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
  },
  statusButtonText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  loginButton: { backgroundColor: "#eaf0ff" },
  loginButtonText: { color: "#345cf2", fontSize: 13, fontWeight: "700" },
  loginHint: { fontSize: 10, color: "#8794aa", lineHeight: 15 },
});
