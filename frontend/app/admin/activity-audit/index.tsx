import { useToastState } from '../../../src/ui/useToastState';
import { AppIcon } from "../../../src/ui/AppIcon";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ToastModal as Modal } from '../../../src/ui/Toast';
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useWorkspaceFocusEffect as useFocusEffect } from '../../../src/core/admin/useWorkspaceFocusEffect';
import { AdminBottomNavigation } from "../../../src/ui/AdminBottomNavigation";
import { AdminPageHeading, useWebSectionHeader } from "../../../src/ui/AdminPageHeading";
import { useAdminLayout } from "../../../src/ui/useAdminLayout";
import { useAdminViewport } from "../../../src/ui/useAdminViewport";
import { selectAdminBranch, useAdminScope } from "../../../src/core/admin/scope";
import { getAdminScope } from "../../../src/core/admin/scope";
import { getAvailableBranches } from "../../../src/core/admin/available-branches";
import { auditApi, type AuditEventDto } from "../../../src/core/admin/api";
import { DatePickerField } from "../../../src/ui/DatePickerField";
import { Dropdown } from "../../../src/ui/Dropdown";

type BranchOption = { id: string; name: string };

const MODULE_OPTIONS = [
  "",
  "BRANCHES",
  "ACCESS",
  "EMPLOYEES",
  "PAYROLL",
  "ADVANCES",
  "ATTENDANCE",
  "TASKS",
  "CRM",
  "DEPARTMENTS",
  "WORKSPACE",
  "BILLING",
  "SUPPORT",
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

const MODULE_COLORS: Record<string, { fg: string; bg: string }> = {
  BRANCHES: { fg: "#345cf2", bg: "#eaf0ff" },
  ACCESS: { fg: "#7c3aed", bg: "#f1eaff" },
  EMPLOYEES: { fg: "#0f8a6d", bg: "#e3f6f0" },
  PAYROLL: { fg: "#b45309", bg: "#fff1de" },
  ADVANCES: { fg: "#c2410c", bg: "#ffeadf" },
  ATTENDANCE: { fg: "#0e7490", bg: "#e0f4f8" },
  TASKS: { fg: "#4f46e5", bg: "#ecebff" },
  CRM: { fg: "#be185d", bg: "#fde8f1" },
  DEPARTMENTS: { fg: "#047857", bg: "#e1f5ec" },
  WORKSPACE: { fg: "#475569", bg: "#eef1f5" },
  BILLING: { fg: "#a16207", bg: "#fdf3d4" },
  SUPPORT: { fg: "#b94d61", bg: "#fdeaee" },
};

function moduleColor(name: string) {
  return MODULE_COLORS[name] ?? { fg: "#475569", bg: "#eef1f5" };
}

function moduleLabel(name: string): string {
  return name ? friendlyAction(name) : "All";
}

function shortId(value: string | null | undefined): string {
  if (!value) return "—";
  return value.length > 12 ? `${value.slice(0, 8)}…` : value;
}

function dayKey(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "unknown"
    : `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function dayLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (dayKey(value) === dayKey(today.toISOString())) return "Today";
  if (dayKey(value) === dayKey(yesterday.toISOString())) return "Yesterday";
  return date.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function timeLabel(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
}

function changesText(value: unknown): string {
  if (value === null || value === undefined) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
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
  const webHeader = useWebSectionHeader();
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
  const [entries, setEntries] = useState<AuditEventDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useToastState("", 'error');
  const [notice, setNotice] = useToastState("", 'info');
  const [refresh, setRefresh] = useState(0);
  const [exporting, setExporting] = useState(false);
  const requestVersion = useRef(0);
  const pagingRef = useRef(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggleExpanded = (id: string) =>
    setExpanded((old) => ({ ...old, [id]: !old[id] }));

  const groups: { key: string; label: string; items: AuditEventDto[] }[] = [];
  for (const event of entries) {
    const key = dayKey(event.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(event);
    else groups.push({ key, label: dayLabel(event.createdAt), items: [event] });
  }
  const moduleOptions = MODULE_OPTIONS.map((value) => ({
    value,
    label: value ? moduleLabel(value) : "All modules",
  }));
  const branchOptions = [
    { value: "", label: "All branches" },
    ...branches.map((item) => ({ value: item.id, label: item.name })),
  ];
  const chooseBranch = (value: string) => {
    setBranchId(value);
    void selectAdminBranch(value || null);
  };

  const activeFilters =
    (branchId ? 1 : 0) + (moduleName ? 1 : 0) + (from ? 1 : 0) + (to ? 1 : 0);


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

          const effectiveBranchId = scope.branchId ?? "";
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
          : "Could not export audit events.", 'error',
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
    <SafeAreaView edges={["left", "right"]} style={styles.safe}>
      <View style={styles.page}>


        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View>
            <AdminPageHeading
              title="Audit trail"
              branch={{ value: selectedBranch?.name || "All branches", label: "Choose audit branch", onPress: () => {} }}
              branchControl={
                <View style={styles.headerSelects}>
                  <Dropdown label="Module" value={moduleName} options={moduleOptions} onChange={setModuleName} style={styles.headerSelect} />
                  <Dropdown valueOnly label="Branch" placeholder="Select a branch" value={branchId} options={branchOptions} onChange={chooseBranch} style={styles.headerSelect} />
                </View>
              }
              onRefresh={() => setRefresh(value => value + 1)}
              refreshing={loading}
            />
          </View>

          <View style={styles.filtersPanel}>
            {!webHeader && (
              <View style={styles.headerSelects}>
                <Dropdown label="Module" value={moduleName} options={moduleOptions} onChange={setModuleName} style={styles.mobileSelect} />
                <Dropdown valueOnly label="Branch" placeholder="Select a branch" value={branchId} options={branchOptions} onChange={chooseBranch} style={styles.mobileSelect} />
              </View>
            )}
            <Text style={styles.sectionLabel}>Date range</Text>
            <View style={styles.filterActions}>
              <View style={styles.dateField}>
                <Text style={styles.fieldLabel}>From</Text>
                <DatePickerField label="Audit start date" hideLabel placeholder="Select date" value={from} onChange={setFrom} maxDate={to || undefined} clearable style={styles.dateInput} />
              </View>
              <View style={styles.dateField}>
                <Text style={styles.fieldLabel}>To</Text>
                <DatePickerField label="Audit end date" hideLabel placeholder="Select date" value={to} onChange={setTo} minDate={from || undefined} clearable style={styles.dateInput} />
              </View>
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
              {!webHeader && <Pressable
                accessibilityRole="button"
                onPress={() => setRefresh((value) => value + 1)}
                style={styles.filterAction}
              >
                <Text style={styles.link}>Refresh</Text>
              </Pressable>}
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
                  {entries.length}
                  {nextCursor ? "+" : ""}{" "}
                  {entries.length === 1 ? "event" : "events"}
                </Text>
                <Text style={styles.subtitle}>
                  {activeFilters
                    ? `${activeFilters} filter${activeFilters === 1 ? "" : "s"} active`
                    : "Showing all activity"}
                </Text>
              </View>
              {groups.map((group) => (
                <View key={group.key} style={styles.dayGroup}>
                  <Text style={styles.dayLabel}>
                    {group.label}
                    <Text style={styles.dayCount}>  ·  {group.items.length}</Text>
                  </Text>
                  <View style={styles.auditGrid}>
                    {group.items.map((event) => {
                      const color = moduleColor(event.module);
                      const open = !!expanded[event.id];
                      const changes = changesText(event.changes);
                      const branchName = event.branchId
                        ? branches.find((item) => item.id === event.branchId)?.name ||
                          shortId(event.branchId)
                        : "";
                      return (
                        <View
                          key={event.id}
                          testID="audit-entry"
                          style={[
                            styles.auditCard,
                            { width: recordGrid.cardWidth, borderLeftColor: color.fg },
                          ]}
                        >
                          <View style={styles.cardHeading}>
                            <Text style={[styles.eventTitle, styles.flex]}>
                              {friendlyAction(event.action)}
                            </Text>
                            <Text
                              style={[
                                styles.moduleBadge,
                                { color: color.fg, backgroundColor: color.bg },
                              ]}
                            >
                              {moduleLabel(event.module)}
                            </Text>
                          </View>
                          {event.detail ? (
                            <Text style={styles.eventDetail}>{event.detail}</Text>
                          ) : null}
                          <View style={styles.eventFooter}>
                            <Text style={styles.timestamp}>
                              {timeLabel(event.createdAt) || dateLabel(event.createdAt)}
                            </Text>
                            {branchName ? (
                              <Text style={styles.actor} numberOfLines={1}>
                                {branchName}
                              </Text>
                            ) : null}
                          </View>
                          <Text style={styles.recordDetail} selectable>
                            Actor {shortId(event.actorId)}  ·  Target {shortId(event.targetId)}
                          </Text>
                          {changes ? (
                            <>
                              <Pressable
                                accessibilityRole="button"
                                accessibilityState={{ expanded: open }}
                                onPress={() => toggleExpanded(event.id)}
                                style={styles.detailsToggle}
                              >
                                <Text style={styles.link}>
                                  {open ? "Hide changes" : "View changes"}
                                </Text>
                              </Pressable>
                              {open ? (
                                <Text style={styles.changesBox} selectable>
                                  {changes}
                                </Text>
                              ) : null}
                            </>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                </View>
              ))}
              {entries.length === 0 ? (
                <View style={styles.empty}>
                  <Text style={styles.eventTitle}>No audit events found</Text>
                  <Text style={styles.subtitle}>
                    {activeFilters
                      ? "No logged activity matches these filters. Try a different module or date range."
                      : "Activity will appear here as your team makes changes."}
                  </Text>
                  {activeFilters ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={resetFilters}
                      style={styles.branchButton}
                    >
                      <Text style={styles.link}>Clear filters</Text>
                    </Pressable>
                  ) : null}
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
  dateField: { flexGrow: 1, flexBasis: 140, minWidth: 0, gap: 6 },
  fieldLabel: { fontSize: 11, fontWeight: "600", color: "#405573" },
  dateInput: {
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
  dayGroup: { gap: 10 },
  dayLabel: { fontSize: 12, fontWeight: "800", color: "#20334f", marginTop: 6 },
  dayCount: { fontWeight: "600", color: "#8192ad" },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    color: "#71829c",
    textTransform: "uppercase",
  },
  headerSelects: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerSelect: { width: 180 },
  mobileSelect: { flex: 1, minWidth: 0 },
  detailsToggle: { minHeight: 36, justifyContent: "center", marginTop: 4 },
  changesBox: {
    fontSize: 10,
    lineHeight: 16,
    color: "#405573",
    backgroundColor: "#f7f9ff",
    borderRadius: 10,
    padding: 10,
    fontFamily: Platform.OS === "web" ? "monospace" : undefined,
  },
  auditCard: {
    minWidth: 0,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderLeftWidth: 4,
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
