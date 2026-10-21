import { AppIcon } from "../../../src/ui/AppIcon";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { AdminBottomNavigation } from "../../../src/ui/AdminBottomNavigation";
import { AdminPageHeading } from "../../../src/ui/AdminPageHeading";
import { useAdminLayout } from "../../../src/ui/useAdminLayout";
import { useAdminViewport } from "../../../src/ui/useAdminViewport";
import { selectAdminBranch, useAdminScope } from "../../../src/core/admin/scope";
import { getAdminScope } from "../../../src/core/admin/scope";
import { getAvailableBranches } from "../../../src/core/admin/available-branches";
import { auditApi, type AuditEventDto } from "../../../src/core/admin/api";
import { DatePickerField } from "../../../src/ui/DatePickerField";

type BranchOption = { id: string; name: string };
type FilterPicker = "branch" | "module" | null;

const MODULE_OPTIONS = [
  "",
  "BRANCHES",
  "ACCESS",
  "EMPLOYEES",
  "PAYROLL",
  "ATTENDANCE",
  "TASKS",
] as const;
const PAGE_SIZE = 40;

function dateLabel(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : date.toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
}

function validDate(value: string): boolean {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const day = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(day.getTime()) && day.toISOString().slice(0, 10) === value
  );
}

function csvCell(value: unknown): string {
  const raw = String(value ?? "");
  return `"${(/^[=+@-]/.test(raw) ? `'${raw}` : raw).replace(/"/g, '""')}"`;
}

function friendlyAction(value: string): string {
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/**
 * BranchSuite Business: authenticated PostgreSQL-backed administrative audit.
 * Historical local CRM/task data is deliberately NOT presented as a security log:
 * it does not reliably identify an actor, tenant, or authoritative mutation.
 */
export default function ActivityAuditPage() {
  const workspaceScope = useAdminScope();
  const { styles, recordGrid } = useAdminLayout(baseStyles);
  const { desktop } = useAdminViewport();
  const router = useRouter();
  const params = useLocalSearchParams<{ branch?: string }>();

  const [companyId, setCompanyId] = useState("");
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [branchId, setBranchId] = useState("");
  useEffect(() => {
    if (workspaceScope) setBranchId(workspaceScope.branchId ?? "");
  }, [workspaceScope?.branchId, workspaceScope?.companyId]);
  const [moduleName, setModuleName] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [picker, setPicker] = useState<FilterPicker>(null);
  const [entries, setEntries] = useState<AuditEventDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [exporting, setExporting] = useState(false);
  const requestVersion = useRef(0);
  const pagingRef = useRef(false);
  const initialBranchApplied = useRef(false);

  const selectedBranch = branches.find((item) => item.id === branchId);
  const fromValid = validDate(from);
  const toValid = validDate(to);
  const validRange = fromValid && toValid && (!from || !to || from <= to);
  const filterMessage =
    !fromValid || !toValid
      ? "Enter valid dates in YYYY-MM-DD format."
      : from && to && from > to
        ? "From date must not be after To date."
        : "";

  useEffect(() => {
    if (initialBranchApplied.current || branches.length === 0) return;
    initialBranchApplied.current = true;
    if (typeof params.branch === "string") {
      const match = branches.find(
        (item) => item.name === params.branch || item.id === params.branch,
      );
      if (match) setBranchId(match.id);
    }
  }, [params.branch, branches]);

  useFocusEffect(
    useCallback(() => {
      const version = ++requestVersion.current;
      let active = true;
      setLoading(true);
      setError("");
      setNotice("");

      async function loadFirstPage() {
        try {
          const [scope, companyBranches] = await Promise.all([
            getAdminScope(),
            getAvailableBranches(),
          ]);
          if (!active || version !== requestVersion.current) return;
          const options = companyBranches.map((item) => ({
            id: item.id,
            name: item.name,
          }));
          setBranches(options);
          setCompanyId(scope.companyId);

          const selectedByParam =
            !initialBranchApplied.current && typeof params.branch === "string"
              ? options.find(
                  (item) =>
                    item.name === params.branch || item.id === params.branch,
                )?.id
              : undefined;
          const effectiveBranchId = options.some(item => item.id === branchId)
            ? branchId
            : selectedByParam || "";
          if (branchId !== effectiveBranchId) setBranchId(effectiveBranchId);
          if (!validRange) {
            setEntries([]);
            setNextCursor(null);
            return;
          }
          const result = await auditApi.list({
            companyId: scope.companyId,
            branchId: effectiveBranchId || undefined,
            module: moduleName || undefined,
            from: from || undefined,
            to: to || undefined,
            limit: PAGE_SIZE,
          });
          if (!active || version !== requestVersion.current) return;
          setEntries(result.items);
          setNextCursor(result.nextCursor);
        } catch (cause) {
          if (active && version === requestVersion.current) {
            setEntries([]);
            setNextCursor(null);
            setError(
              cause instanceof Error
                ? cause.message
                : "Could not load audit history.",
            );
          }
        } finally {
          if (active && version === requestVersion.current) setLoading(false);
        }
      }
      void loadFirstPage();
      return () => {
        active = false;
        requestVersion.current += 1;
      };
    }, [branchId, moduleName, from, to, refresh, validRange, params.branch]),
  );

  const fetchMore = async () => {
    if (!nextCursor || pagingRef.current || loading || !validRange) return;
    pagingRef.current = true;
    setLoadingMore(true);
    setError("");
    const version = requestVersion.current;
    try {
      const result = await auditApi.list({
        companyId,
        branchId: branchId || undefined,
        module: moduleName || undefined,
        from: from || undefined,
        to: to || undefined,
        cursor: nextCursor,
        limit: PAGE_SIZE,
      });
      if (version !== requestVersion.current) return;
      setEntries((old) => {
        const seen = new Set(old.map((item) => item.id));
        return [...old, ...result.items.filter((item) => !seen.has(item.id))];
      });
      setNextCursor(result.nextCursor);
    } catch (cause) {
      if (version === requestVersion.current) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not load more events.",
        );
      }
    } finally {
      pagingRef.current = false;
      setLoadingMore(false);
    }
  };

  const exportCsv = async () => {
    if (exporting || entries.length === 0) return;
    setExporting(true);
    setNotice("");
    try {
      const table: (string | number)[][] = [
        [
          "Timestamp",
          "Module",
          "Action",
          "Actor ID",
          "Target ID",
          "Company ID",
          "Branch ID",
          "Detail",
        ],
        ...entries.map((event) => [
          event.createdAt,
          event.module,
          event.action,
          event.actorId,
          event.targetId,
          event.companyId || "",
          event.branchId || "",
          event.detail,
        ]),
      ];
      const csv =
        "\uFEFF" +
        table.map((line) => line.map(csvCell).join(",")).join("\r\n");
      const fileName = `branchsuite-audit-${new Date().toISOString().slice(0, 10)}.csv`;
      if (Platform.OS === "web") {
        const url = URL.createObjectURL(
          new Blob([csv], { type: "text/csv;charset=utf-8" }),
        );
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = fileName;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else {
        const { File, Paths } = await import("expo-file-system");
        const Sharing = await import("expo-sharing");
        if (!(await Sharing.isAvailableAsync()))
          throw new Error("Sharing is unavailable on this device.");
        const file = new File(Paths.cache, fileName);
        file.create({ overwrite: true });
        file.write(csv);
        await Sharing.shareAsync(file.uri, {
          mimeType: "text/csv",
          dialogTitle: "Export audit events",
        });
      }
      setNotice(
        `Export includes ${entries.length} loaded audit events only. Load more pages to include additional events.`,
      );
    } catch (cause) {
      setNotice(
        cause instanceof Error
          ? cause.message
          : "Could not export audit events.",
      );
    } finally {
      setExporting(false);
    }
  };

  const resetFilters = () => {
    setBranchId("");
    setModuleName("");
    setFrom("");
    setTo("");
    setRefresh((value) => value + 1);
  };

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.safe}>
      <View style={styles.page}>


        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View>
            
            <AdminPageHeading title="Audit trail">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Choose audit branch"
                onPress={() => setPicker("branch")}
                style={[styles.branchButton, styles.dropdownAction]}
              >
                <Text style={styles.link}>
                  {selectedBranch?.name || "All branches"}
                </Text>
                <AppIcon name="chevron-down" size={16} color="#607591" />
              </Pressable>
            </AdminPageHeading>
          </View>

          <View style={styles.filtersPanel}>
            <View style={styles.filterActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Filter audit module"
                onPress={() => setPicker("module")}
                style={[styles.filterAction, styles.dropdownAction]}
              >
                <Text style={styles.filterText}>
                  Module: {moduleName || "All logged"}
                </Text>
                <AppIcon name="chevron-down" size={16} color="#607591" />
              </Pressable>
              <DatePickerField label="Audit start date" value={from} onChange={setFrom} maxDate={to || undefined} clearable style={styles.dateInput} />
              <DatePickerField label="Audit end date" value={to} onChange={setTo} minDate={from || undefined} clearable style={styles.dateInput} />
            </View>
            {filterMessage ? (
              <Text style={styles.error}>{filterMessage}</Text>
            ) : null}
            <View style={styles.filterActions}>
              <Pressable
                accessibilityRole="button"
                onPress={resetFilters}
                style={styles.filterAction}
              >
                <Text style={styles.link}>Reset filters</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => setRefresh((value) => value + 1)}
                style={styles.filterAction}
              >
                <Text style={styles.link}>Refresh</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={!entries.length || exporting}
                onPress={() => void exportCsv()}
                style={[
                  styles.filterAction,
                  (!entries.length || exporting) && styles.disabled,
                ]}
              >
                <Text style={styles.link}>
                  {exporting ? "Exporting…" : "Export loaded CSV"}
                </Text>
              </Pressable>
            </View>
          </View>

          {loading ? (
            <ActivityIndicator
              accessibilityLabel="Loading audit events"
              color="#345cf2"
            />
          ) : error && entries.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.error}>{error}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setRefresh((value) => value + 1)}
                style={styles.branchButton}
              >
                <Text style={styles.link}>Retry</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.summaryBar}>
                <Text style={styles.eventTitle}>
                  {entries.length} loaded{" "}
                  {entries.length === 1 ? "event" : "events"}
                </Text>
                <Text style={styles.subtitle}>
                  {moduleName || "All logged modules"}
                </Text>
              </View>
              <View style={styles.auditGrid}>
                {entries.map((event) => (
                  <View
                    key={event.id}
                    testID="audit-entry"
                    style={[styles.auditCard, { width: recordGrid.cardWidth }]}
                  >
                    <View style={styles.cardHeading}>
                      <Text style={[styles.eventTitle, styles.flex]}>
                        {friendlyAction(event.action)}
                      </Text>
                      <Text style={styles.moduleBadge}>{event.module}</Text>
                    </View>
                    {event.detail ? (
                      <Text style={styles.eventDetail}>{event.detail}</Text>
                    ) : null}
                    <View style={styles.eventFooter}>
                      <Text style={styles.actor}>Actor: {event.actorId}</Text>
                      <Text style={styles.timestamp}>
                        {dateLabel(event.createdAt)}
                      </Text>
                    </View>
                    <Text style={styles.recordDetail}>
                      Target: {event.targetId}
                    </Text>
                    {event.branchId ? (
                      <Text style={styles.recordDetail}>
                        Branch:{" "}
                        {branches.find((item) => item.id === event.branchId)
                          ?.name || event.branchId}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </View>
              {entries.length === 0 ? (
                <View style={styles.empty}>
                  <Text style={styles.eventTitle}>No audit events found</Text>
                  <Text style={styles.subtitle}>
                    No logged activity matches these filters. Only actions
                    instrumented after the audit migration appear here.
                  </Text>
                </View>
              ) : null}
              {error ? <Text style={styles.error}>{error}</Text> : null}
              {nextCursor ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={loadingMore}
                  onPress={() => void fetchMore()}
                  style={[styles.loadMore, loadingMore && styles.disabled]}
                >
                  <Text style={styles.loadMoreText}>
                    {loadingMore ? "Loading…" : "Load more events"}
                  </Text>
                </Pressable>
              ) : null}
              {notice ? <Text style={styles.subtitle}>{notice}</Text> : null}
              
            </>
          )}
        </ScrollView>
        {!desktop ? <AdminBottomNavigation /> : null}
      </View>

      <Modal
        visible={picker !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPicker(null)}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.headerRow}>
              <Text style={[styles.eventTitle, styles.flex]}>
                {picker === "branch" ? "Choose branch" : "Choose module"}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close filter"
                onPress={() => setPicker(null)}
                style={styles.branchButton}
              >
                <Text style={styles.link}>Close</Text>
              </Pressable>
            </View>
            <ScrollView>
              {picker === "branch"
                ? [{ id: "", name: "All branches" }, ...branches].map(
                    (option) => (
                      <Pressable
                        key={option.id || "all"}
                        accessibilityRole="button"
                        accessibilityState={{
                          selected: option.id === branchId,
                        }}
                        onPress={() => {
                          setBranchId(option.id);
                          void selectAdminBranch(option.id || null);
                          setPicker(null);
                        }}
                        style={styles.branchOption}
                      >
                        <Text style={styles.filterText}>
                          {option.name}
                          <AppIcon symbol={option.id === branchId ? "  ✓" : ""} size={16} />
                        </Text>
                      </Pressable>
                    ),
                  )
                : MODULE_OPTIONS.map((value) => (
                    <Pressable
                      key={value || "all"}
                      accessibilityRole="button"
                      accessibilityState={{ selected: value === moduleName }}
                      onPress={() => {
                        setModuleName(value);
                        setPicker(null);
                      }}
                      style={styles.branchOption}
                    >
                      <Text style={styles.filterText}>
                        {value || "All logged modules"}
                        <AppIcon symbol={value === moduleName ? "  ✓" : ""} size={16} />
                      </Text>
                    </Pressable>
                  ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const baseStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f6f8fd" },
  page: { flex: 1, width: "100%", maxWidth: 1280, alignSelf: "center" },
  flex: { flex: 1, minWidth: 0 },
  header: {
    padding: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e4eaf5",
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  companyName: { fontSize: 13, fontWeight: "800", color: "#20334f" },
  headerCaption: { fontSize: 9, lineHeight: 14, color: "#8192ad" },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "#eaf0ff",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 12, fontWeight: "700", color: "#345cf2" },
  headerFilters: { flexDirection: "row", gap: 8, marginTop: 14 },
  headerFilter: {
    flex: 1,
    minWidth: 0,
    minHeight: 34,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
    padding: 10,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#e4eaf5",
    backgroundColor: "#f7f9ff",
  },
  filterText: { fontSize: 11, color: "#405573", flexShrink: 1 },
  selectedFilter: { backgroundColor: "#eaf0ff", borderColor: "#d5dfff" },
  content: { padding: 16, paddingTop: 24, paddingBottom: 32, gap: 12 },
  heading: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 10,
  },
  back: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderColor: "#e4eaf5",
    borderRadius: 10,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  backGlyph: { fontSize: 24, color: "#405573" },
  eyebrow: {
    fontSize: 9,
    letterSpacing: 1.5,
    fontWeight: "700",
    color: "#71829c",
  },
  title: {
    fontSize: 25,
    lineHeight: 33,
    fontWeight: "800",
    color: "#20334f",
    marginTop: 6,
  },
  subtitle: { fontSize: 11, lineHeight: 18, color: "#71829c", marginTop: 4 },
  branchButton: { minHeight: 44, padding: 10, justifyContent: "center" },
  dropdownAction: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  link: { fontSize: 11, lineHeight: 17, fontWeight: "600", color: "#345cf2" },
  filtersPanel: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e4eaf5",
    borderRadius: 16,
    padding: 12,
    gap: 10,
  },
  filterActions: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  filterAction: {
    padding: 11,
    minHeight: 42,
    borderRadius: 10,
    backgroundColor: "#eaf0ff",
    justifyContent: "center",
  },
  dateInput: {
    flexGrow: 1,
    flexBasis: 140,
    minHeight: 42,
    borderWidth: 1,
    borderColor: "#dce5f3",
    borderRadius: 10,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    color: "#20334f",
  },
  summaryBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  auditGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  auditCard: {
    minWidth: 0,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e4eaf5",
    backgroundColor: "#fff",
  },
  cardHeading: { flexDirection: "row", alignItems: "center", gap: 10 },
  moduleBadge: {
    fontSize: 10,
    color: "#345cf2",
    fontWeight: "700",
    backgroundColor: "#eaf0ff",
    padding: 6,
    borderRadius: 8,
  },
  eventTitle: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "700",
    color: "#20334f",
  },
  eventDetail: {
    fontSize: 11,
    lineHeight: 18,
    color: "#71829c",
    marginTop: 12,
  },
  eventFooter: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: 12,
    rowGap: 6,
    borderTopWidth: 1,
    borderTopColor: "#edf1f8",
    marginTop: 16,
    paddingTop: 12,
  },
  actor: { flexShrink: 1, fontSize: 10, lineHeight: 16, color: "#71829c" },
  timestamp: { flexShrink: 1, fontSize: 10, lineHeight: 16, color: "#71829c" },
  recordDetail: {
    fontSize: 10,
    lineHeight: 16,
    color: "#8192ad",
    marginTop: 7,
  },
  empty: {
    padding: 20,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e4eaf5",
    backgroundColor: "#fff",
    gap: 8,
  },
  error: { fontSize: 13, lineHeight: 20, color: "#b94d61" },
  disabled: { opacity: 0.5 },
  loadMore: {
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: "#345cf2",
    alignItems: "center",
    justifyContent: "center",
  },
  loadMoreText: { fontSize: 12, fontWeight: "700", color: "#fff" },
  footer: {
    fontSize: 10,
    lineHeight: 16,
    textAlign: "center",
    color: "#8192ad",
    marginTop: 20,
  },
  overlay: {
    flex: 1,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(21,43,60,0.25)",
  },
  modal: {
    width: "100%",
    maxWidth: 460,
    maxHeight: "85%",
    padding: 20,
    backgroundColor: "#fff",
    borderRadius: 18,
  },
  branchOption: { minHeight: 48, padding: 12, justifyContent: "center" },
});
