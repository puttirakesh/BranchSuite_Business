import { useToastState } from '../../../src/ui/useToastState';
import { employeeDisplayId } from '../../../src/core/employee-display';
import { buildReportPdf } from '../../../src/core/admin/report-pdf';
import { AppIcon } from "../../../src/ui/AppIcon";
import { AdminPageHeading, useWebSectionHeader } from '../../../src/ui/AdminPageHeading';
import { AdminBottomNavigation } from "../../../src/ui/AdminBottomNavigation";
import { useAdminLayout } from "../../../src/ui/useAdminLayout";
import { useAdminViewport } from "../../../src/ui/useAdminViewport";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { isBusinessAdminRole } from '../../../src/core/admin/access';
import { useAuth } from '../../../src/core/auth/AuthProvider';
import { companyRoles, canPreparePayroll, canApprovePayroll, canManageTasks } from '../../../src/core/admin/role-capabilities';
import { dealsApi, type DealDto } from '../../../src/core/admin/deals.api';
import { useLocalSearchParams, useRouter } from "expo-router";
import { useWorkspaceFocusEffect as useFocusEffect } from '../../../src/core/admin/useWorkspaceFocusEffect';
import { getAdminScope, selectAdminBranch, useAdminScope } from "../../../src/core/admin/scope";
import { getAvailableBranches } from "../../../src/core/admin/available-branches";
import { readPayroll, type PayrollRecord } from "../../../src/core/payroll";
import { readTeamAttendance } from "../../../src/core/admin/attendance";
import { leaveApi } from "../../../src/core/admin/api";
import { readTasks, type AdminTask } from "../../../src/core/admin/tasks";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { Dropdown } from "../../../src/ui/Dropdown";
import { SafeAreaView } from "react-native-safe-area-context";
import { getEmployees, type Employee } from "../../../src/core/employees";

const reportNames = [
  "Payroll summary",
  "Employee directory",
  "Attendance summary",
  "Leave requests",
  "Task summary",
  "Sales pipeline",
] as const;
type ReportName = (typeof reportNames)[number];
type Picker = "report" | "branch" | "period";
type Payroll = PayrollRecord;
type Shift = {
  employeeId: string;
  date: string;
  checkIn: string;
  checkOut: string;
  branch?: string;
  needsReview?: boolean;
  status?: string;
};
type Request = {
  employeeId?: string;
  employeeName?: string;
  branch?: string;
  type: string;
  startDate: string;
  endDate: string;
  status: string;
  reason: string;
};
const currentMonth = () => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  return `${parts.find((p) => p.type === "year")?.value}-${parts.find((p) => p.type === "month")?.value}`;
};
const dateOnly = (value: string) => value.slice(0, 10);
const periodLabel = (value: string) =>
  value
    ? new Date(`${value}-01T12:00:00+05:30`).toLocaleDateString("en-GB", {
        timeZone: "Asia/Kolkata",
        month: "long",
        year: "numeric",
      })
    : "All periods";
const joiningDate = (employee: Employee) => {
  const match = /^(\d{2})[/-](\d{2})[/-](\d{4})$/.exec(employee.joiningDate);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : employee.joiningDate;
};
const htmlEscape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
const csvCell = (value: string) =>
  `"${(/^[\s]*[=+@-]/.test(value) ? "'" + value : value).replace(/"/g, '""')}"`;

export default function BranchReportsPage() {
  const webHeader = useWebSectionHeader();
  const selection = useAdminScope();
  const { session } = useAuth();
  const roles = companyRoles(session, selection?.companyId);
  const { desktop } = useAdminViewport();
  const { styles, contentWidth } = useAdminLayout(baseStyles, "page");
  const router = useRouter();
  const params = useLocalSearchParams<{ branch?: string }>();
  const [branch, setBranch] = useState(
    typeof params.branch === "string" ? params.branch : "",
  );
  const [report, setReport] = useState<ReportName>("Employee directory");
  const [period, setPeriod] = useState('');
  const permittedReports = reportNames.filter(name => roles.some(isBusinessAdminRole) || (
    name === 'Sales pipeline' ? canManageTasks(roles)
      : name === 'Task summary' ? roles.some(role => ['BUSINESS_OWNER', 'BUSINESS_ADMIN', 'COMPANY_MANAGER', 'BRANCH_MANAGER'].includes(role))
      : name === 'Payroll summary' ? canPreparePayroll(roles) || canApprovePayroll(roles)
      : name === 'Leave requests' ? roles.some(role => ['COMPANY_MANAGER', 'BRANCH_MANAGER', 'HR_MANAGER'].includes(role))
      : roles.some(role => ['COMPANY_MANAGER', 'BRANCH_MANAGER', 'HR_MANAGER', 'PAYROLL_MANAGER'].includes(role))));
  useEffect(() => { if (!permittedReports.includes(report) && permittedReports.length) setReport(permittedReports[0]); }, [selection?.role, report, permittedReports.join('|')]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payroll, setPayroll] = useState<Payroll[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [tasks, setTasks] = useState<AdminTask[]>([]);
  const [deals, setDeals] = useState<(DealDto & { branch: string })[]>([]);
  const [allowedBranches, setAllowedBranches] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useToastState("", 'error');
  const [attempt, setAttempt] = useState(0);
  const [exportError, setExportError] = useToastState("", 'error');
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);
  const [notice, setNotice] = useToastState("", 'success');
  const exportRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setError("");
      const load = async () => {
        if (!permittedReports.includes(report)) return;
        const scope = await getAdminScope();
        const permitted = await getAvailableBranches(scope.companyId);
        const [team, salaries, attendance, leaves, activities, opportunities] =
          await Promise.all([
            report !== 'Sales pipeline' && report !== 'Task summary' ? getEmployees() : [],
            report === 'Payroll summary' ? readPayroll() : [],
            report === 'Attendance summary' ? readTeamAttendance({
              fromDate: `${Number(currentMonth().slice(0, 4)) - 1}-01-01`,
            }) : [],
            report === 'Leave requests' ? leaveApi.requests(scope.companyId) : [],
            report === 'Task summary' ? readTasks() : [],
            report === 'Sales pipeline' ? dealsApi.list(scope.companyId) : [],
          ]);
        if (!active) return;
        const names = new Map(permitted.map((item) => [item.id, item.name]));
        setDeals(opportunities.filter(item => item.branchId && names.has(item.branchId)).map(item => ({ ...item, branch: names.get(item.branchId!)! })));
        setAllowedBranches(permitted.map((item) => item.name));
        setBranch(scope.branchId ? names.get(scope.branchId) ?? "" : "");
        setEmployees(
          team.filter((item) => permitted.some((b) => b.name === item.branch)),
        );
        setPayroll(
          salaries.filter((item) =>
            permitted.some((b) => b.name === item.branch),
          ),
        );
        setShifts(
          attendance
            .filter((item) => permitted.some((b) => b.name === item.branch))
            .map((item) => ({
              employeeId: item.employeeId,
              date: dateOnly(item.date),
              checkIn: item.checkIn,
              checkOut: item.checkOut,
              branch: item.branch,
              needsReview: item.needsReview,
              status: item.status,
            })),
        );
        setRequests(
          leaves
            .filter((item) => names.has(item.branchId))
            .map((item) => ({
              employeeId: item.userId,
              branch: names.get(item.branchId),
              type: "leave",
              startDate: dateOnly(item.startDate),
              endDate: dateOnly(item.endDate),
              status: item.status,
              reason: item.reason,
            })),
        );
        setTasks(
          activities.filter((item) =>
            permitted.some((b) => b.name === item.branch),
          ),
        );
      };
      void load()
        .catch((reason) => {
          if (active)
            setError(
              reason instanceof Error
                ? reason.message
                : "Could not load backend reports.",
            );
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [attempt, report, selection?.companyId, selection?.branchId, selection?.role, params.branch]),
  );

  const employeeFor = (id?: string) =>
    employees.find((employee) => employee.id === id);
  const branchFor = (record: { branch?: string; employeeId?: string }) =>
    record.branch || employeeFor(record.employeeId)?.branch || "";
  const nameFor = (record: { employeeId?: string; employeeName?: string }) =>
    record.employeeName ||
    employeeFor(record.employeeId)?.fullName ||
    (record.employeeId ? "Unknown employee" : "Personal request");
  const branches = [...new Set(allowedBranches)].sort();
  const months = new Set([
    currentMonth(),
    ...payroll.map((item) => item.period),
    ...shifts.map((item) => item.date.slice(0, 7)),
    ...requests.map((item) => item.startDate.slice(0, 7)),
    ...employees.map((item) => joiningDate(item).slice(0, 7)),
    ...tasks.map((item) => dateOnly(item.createdAt).slice(0, 7)),
    ...deals.map(item => dateOnly(item.createdAt).slice(0, 7)),
  ]);
  const base = new Date(`${currentMonth()}-01T12:00:00+05:30`);
  for (let index = 0; index < 12; index++) {
    const month = new Date(
      Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - index, 1),
    );
    months.add(
      `${month.getUTCFullYear()}-${String(month.getUTCMonth() + 1).padStart(2, "0")}`,
    );
  }
  const periods = [...months]
    .filter((value) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value))
    .sort()
    .reverse();
  const matchesBranch = (record: { branch?: string; employeeId?: string }) =>
    !branch || branchFor(record) === branch;
  let headers: string[];
  let rows: string[][];
  if (report === 'Sales pipeline') {
    headers = ['Opportunity', 'Branch', 'Stage', 'Amount', 'Currency', 'Expected close', 'Created'];
    rows = deals.filter(item => (!branch || item.branch === branch) && (!period || item.createdAt.slice(0, 7) === period)).map(item => [item.title, item.branch, item.stage, Number(item.amount ?? 0).toFixed(2), item.currency, item.expectedCloseAt?.slice(0, 10) ?? '', item.createdAt.slice(0, 10)]);
  } else if (report === "Payroll summary") {
    headers = [
      "Employee ID",
      "Name",
      "Branch",
      "Gross INR",
      "Deductions INR",
      "Net INR",
      "Period",
      "Run status",
    ];
    rows = payroll
      .filter(
        (item) => matchesBranch(item) && (!period || item.period === period),
      )
      .map((item) => [
        employeeDisplayId(employeeFor(item.employeeId)),
        nameFor(item),
        branchFor(item),
        item.gross.toFixed(2),
        item.deductions.toFixed(2),
        (item.gross - item.deductions).toFixed(2),
        periodLabel(item.period),
        item.runStatus ?? "Salary estimate (not calculated)",
      ]);
  } else if (report === "Employee directory") {
    headers = [
      "Employee ID",
      "Name",
      "Branch",
      "Department",
      "Work email",
      "Joining date",
      "Status",
    ];
    rows = employees
      .filter(
        (item) =>
          (!branch || item.branch === branch) &&
          (!period || joiningDate(item).slice(0, 7) === period),
      )
      .map((item) => [
        employeeDisplayId(item),
        item.fullName,
        item.branch,
        item.department,
        item.email,
        item.joiningDate,
        item.status === "inactive" ? "Inactive" : "Active",
      ]);
  } else if (report === "Attendance summary") {
    headers = [
      "Employee ID",
      "Name",
      "Branch",
      "Date",
      "Check in",
      "Check out",
      "Status",
    ];
    rows = shifts
      .filter(
        (item) =>
          matchesBranch(item) && (!period || item.date.slice(0, 7) === period),
      )
      .map((item) => [
        employeeDisplayId(employeeFor(item.employeeId)),
        nameFor(item),
        branchFor(item),
        item.date,
        item.checkIn || "—",
        item.checkOut || "—",
        item.needsReview
          ? "Needs review"
          : item.status || (item.checkIn ? "Present" : "Not checked in"),
      ]);
  } else if (report === "Leave requests") {
    headers = [
      "Employee ID",
      "Name",
      "Branch",
      "Start date",
      "End date",
      "Status",
      "Reason",
    ];
    const monthStart = period ? `${period}-01` : "";
    const monthEnd = period
      ? `${period}-${String(new Date(Number(period.slice(0, 4)), Number(period.slice(5)), 0).getDate())}`
      : "";
    rows = requests
      .filter(
        (item) =>
          item.type === "leave" &&
          matchesBranch(item) &&
          (!period ||
            (item.startDate <= monthEnd && item.endDate >= monthStart)),
      )
      .map((item) => [
        employeeDisplayId(employeeFor(item.employeeId)),
        nameFor(item),
        branchFor(item),
        item.startDate,
        item.endDate,
        item.status,
        item.reason,
      ]);
  } else {
    headers = [
      "Task ID",
      "Title",
      "Branch",
      "Assigned employee",
      "Type",
      "Status",
      "Due date",
    ];
    rows = tasks
      .filter(
        (item) =>
          (!branch || item.branch === branch) &&
          (!period || dateOnly(item.createdAt).slice(0, 7) === period),
      )
      .map((item) => [
        item.id,
        item.title,
        item.branch,
        item.employeeName || employeeFor(item.employeeId)?.fullName ||
          (item.employeeId ? "Unknown employee" : "Unassigned"),
        item.type,
        item.status,
        item.dueDate,
      ]);
  }
  const optionsFor = (kind: Picker) =>
    kind === "report"
      ? permittedReports.map((value) => ({ value, label: value }))
      : kind === "branch"
        ? ["", ...branches].map(
            (value) => ({ value, label: value || "All branches" }),
          )
        : ["", ...periods].map((value) => ({
            value,
            label: periodLabel(value),
          }));
  const selectValue = (kind: Picker, value: string) => {
    if (kind === "report") setReport(value as ReportName);
    else if (kind === "branch") {
      setBranch(value);
      void selectAdminBranch(selection?.branches.find(item => item.name === value)?.id ?? null);
    }
    else setPeriod(value);
    setNotice("");
    setExportError("");
  };
  const select = (kind: Picker, label: string, style?: StyleProp<ViewStyle>) => (
    <Dropdown
      label={label}
      valueOnly={kind === 'branch'}
      placeholder={kind === 'branch' ? 'Select a branch' : 'Select an option'}
      value={kind === "report" ? report : kind === "branch" ? branch : period}
      options={optionsFor(kind)}
      onChange={(value) => selectValue(kind, value)}
      style={style}
    />
  );

  const exportReport = async (format: "csv" | "pdf") => {
    if (loading || error || !rows.length || exportRef.current) return;
    exportRef.current = true;
    setExporting(format);
    setExportError("");
    setNotice("");
    const filename = `${report.toLowerCase().replaceAll(" ", "-")}-${period || "all-periods"}-${Date.now()}`;
    try {
      const title = `${report} · ${branch || "All branches"} · ${periodLabel(period)}`;
      const csv =
        "\uFEFF" +
        [headers, ...rows]
          .map((row) => row.map(csvCell).join(","))
          .join("\r\n");
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>${htmlEscape(report)}</title><style>body{font:12px Arial;color:#20334f}h1{font-size:22px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #dce5f3;padding:8px;text-align:left;word-break:break-word}th{background:#f2f5fc}thead{display:table-header-group}tr{break-inside:avoid}@page{size:A4 landscape;margin:15mm}</style></head><body><h1>${htmlEscape(title)}</h1><p>${rows.length} records</p><table><thead><tr>${headers.map((value) => `<th>${htmlEscape(value)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((value) => `<td>${htmlEscape(value)}</td>`).join("")}</tr>`).join("")}</tbody></table></body></html>`;
      if (Platform.OS === "web") {
        if (format === "csv") {
          const url = URL.createObjectURL(
            new Blob([csv], { type: "text/csv;charset=utf-8" }),
          );
          const link = document.createElement("a");
          link.href = url;
          link.download = `${filename}.csv`;
          document.body.appendChild(link);
          link.click();
          link.remove();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          setNotice("CSV download started.");
        } else {
          const pdf = await buildReportPdf(title, headers, rows);
          await pdf.save(filename + '.pdf', { returnPromise: true });
          setNotice("PDF download started.");
        }
      } else {

        if (Platform.OS === 'android') {
          const { saveAndroidReport } = await import('../../../src/core/admin/android-report-export');
          await saveAndroidReport(format, filename, csv, html);
          setNotice(format.toUpperCase() + ' saved to the selected folder.');
          return;
        }
        let uri: string;
        if (format === 'csv') {
          const { File, Paths } = await import('expo-file-system');
          const file = new File(Paths.cache, filename + '.csv');
          file.create();
          file.write(csv);
          uri = file.uri;
        } else {
          const Print = await import('expo-print');
          uri = (await Print.printToFileAsync({ html })).uri;
        }
        const Sharing = await import('expo-sharing');
        if (!(await Sharing.isAvailableAsync())) throw new Error('File sharing is unavailable on this device.');
        await Sharing.shareAsync(uri, {
          mimeType: format === "csv" ? "text/csv" : "application/pdf",
          UTI:
            format === "csv"
              ? "public.comma-separated-values-text"
              : "com.adobe.pdf",
          dialogTitle: `Save ${report}`,
        });
        setNotice("Export ready. Choose where to save or share it.");
      }
    } catch (reason) {
      if (reason instanceof Error && /cancel|dismiss|ERR_PICKER_REJECTED/i.test(reason.message + ' ' + (reason as Error & { code?: string }).code)) {
        setNotice('Export cancelled.', 'info');
        return;
      }
      setExportError(
        reason instanceof Error
          ? reason.message
          : "Could not export the report. Please try again.",
      );
    } finally {
      exportRef.current = false;
      setExporting(null);
    }
  };

  const field = (label: string, kind: Picker) => (
    <View style={[styles.field, styles.filterField]}>
      {select(kind, label)}
    </View>
  );
  return (
    <SafeAreaView edges={["left", "right"]} style={styles.safe}>
      <View style={styles.page}>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          
          <AdminPageHeading title="Branch reports" branchControl={select("branch", "Branch", { width: 180 })} onRefresh={() => setAttempt(value => value + 1)} refreshing={loading} />
          <View style={styles.card}>
            <View style={styles.filterGrid}>
              {field("Report", "report")}
              {!webHeader && field("Branch", "branch")}
              {field("Period", "period")}
            </View>

            <View style={styles.exportButtons}>
              {(["csv", "pdf"] as const).map((format) => (
                <Pressable
                  key={format}
                  accessibilityRole="button"
                  accessibilityLabel={`Save ${format.toUpperCase()}`}
                  accessibilityState={{
                    disabled: loading || !!error || !rows.length || !!exporting,
                    busy: exporting === format,
                  }}
                  disabled={loading || !!error || !rows.length || !!exporting}
                  onPress={() => void exportReport(format)}
                  style={[
                    styles.exportButton,
                    format === "pdf" && styles.blue,
                    (loading || !!error || !rows.length || exporting) &&
                      styles.dim,
                  ]}
                >
                  <Text
                    style={format === "pdf" ? styles.link : styles.buttonText}
                  >
                    {exporting === format ? "Preparing…" : `Save ${format.toUpperCase()}`}
                  </Text>
                </Pressable>
              ))}
            </View>
            {notice !== "" && (
              <Text accessibilityLiveRegion="polite" style={styles.notice}>
                {notice}
              </Text>
            )}
            {exportError !== "" && (
              <Text accessibilityLiveRegion="polite" style={styles.error}>
                {exportError}
              </Text>
            )}
          </View>

          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.reportTitle}>{report}</Text>
              <View style={styles.recordBadge}>
                <Text style={styles.small}>
                  {loading || error ? "—" : rows.length} records
                </Text>
              </View>
            </View>
            {loading ? (
              <ActivityIndicator
                accessibilityLabel="Loading reports"
                style={styles.loading}
                color="#345cf2"
              />
            ) : error ? (
              <View>
                <Text style={styles.error}>{error}</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setAttempt((value) => value + 1)}
                  style={styles.change}
                >
                  <Text style={styles.link}>Retry</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator
                  contentContainerStyle={styles.table}
                >
                  <View>
                    <View style={styles.tableHeader}>
                      {headers.map((header) => (
                        <Text
                          key={header}
                          style={[
                            styles.cell,
                            {
                              width: Math.max(
                                128,
                                Math.floor(
                                  (contentWidth - 42) / headers.length,
                                ),
                              ),
                            },
                            styles.columnTitle,
                          ]}
                        >
                          {header}
                        </Text>
                      ))}
                    </View>
                    {rows.map((row, index) => (
                      <View key={index} style={styles.tableRow}>
                        {row.map((value, column) => (
                          <Text
                            key={column}
                            style={[
                              styles.cell,
                              {
                                width: Math.max(
                                  128,
                                  Math.floor(
                                    (contentWidth - 42) / headers.length,
                                  ),
                                ),
                              },
                            ]}
                          >
                            {value || "—"}
                          </Text>
                        ))}
                      </View>
                    ))}
                  </View>
                </ScrollView>
                {rows.length === 0 && (
                  <View style={styles.empty}>
                    <Text style={styles.name}>
                      No records for this selection
                    </Text>
                    <Text style={styles.subtitle}>
                      No matching backend records were returned. Try another
                      report, branch or period.
                    </Text>
                  </View>
                )}
              </>
            )}
          </View>
        </ScrollView>
        <AdminBottomNavigation />
      </View>
    </SafeAreaView>
  );
}

const baseStyles = StyleSheet.create({
  headerIdentity: { alignItems: "center" },
  filterGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  filterField: { flexGrow: 1, flexBasis: 155, minWidth: 140 },
  safe: { flex: 1, backgroundColor: "#f6f8fd" },
  page: { flex: 1, width: "100%", maxWidth: 560, alignSelf: "center" },
  flex: { flex: 1 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 9,
  },
  header: {
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e4eaf5",
  },
  companyName: {
    minHeight: 18,
    fontSize: 14,
    fontWeight: "800",
    color: "#20334f",
  },
  small: { fontSize: 9, lineHeight: 16, color: "#8192ad" },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f5f7fc",
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "#eaf0ff",
  },
  headerFilters: { flexDirection: "row", gap: 8, marginTop: 14 },
  headerFilter: {
    flex: 1,
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#e4eaf7",
    backgroundColor: "#f7f9ff",
  },
  chevron: { fontSize: 23, color: "#607591" },
  blue: { backgroundColor: "#eaf0ff", borderColor: "#d5dfff" },
  content: { padding: 16, paddingTop: 24, paddingBottom: 28 },
  eyebrow: {
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 2,
    color: "#8192ad",
  },
  title: {
    fontSize: 25,
    fontWeight: "800",
    color: "#20334f",
    marginTop: 10,
    letterSpacing: -0.7,
  },
  subtitle: { fontSize: 11, lineHeight: 18, color: "#7a8ba5", marginTop: 5 },
  branchCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e4eaf5",
    borderRadius: 17,
    backgroundColor: "#fff",
    marginTop: 22,
  },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#39b8a7" },
  name: { fontSize: 12, fontWeight: "700", color: "#20334f" },
  change: { minHeight: 44, paddingHorizontal: 8, justifyContent: "center" },
  link: { fontSize: 10, fontWeight: "600", color: "#345cf2" },
  card: {
    padding: 18,
    borderWidth: 1,
    borderColor: "#e0e8f5",
    borderRadius: 18,
    backgroundColor: "#fff",
    marginTop: 16,
  },
  field: { marginBottom: 24 },
  label: { fontSize: 12, fontWeight: "600", color: "#405573", marginBottom: 8 },
  select: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    borderWidth: 1,
    borderColor: "#dce5f3",
    borderRadius: 13,
    backgroundColor: "#fcfdff",
    paddingHorizontal: 13,
  },
  inputText: { flexShrink: 1, fontSize: 13, color: "#20334f" },
  exportButtons: { flexDirection: "row", gap: 10 },
  exportButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e1e8f4",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  buttonText: { fontSize: 11, fontWeight: "600", color: "#405573" },
  dim: { opacity: 0.5 },
  notice: { marginTop: 12, fontSize: 12, color: "#34856c" },
  error: { marginTop: 12, fontSize: 12, color: "#b94d61" },
  scope: {
    marginTop: 14,
    borderRadius: 13,
    backgroundColor: "#eaf0ff",
    padding: 14,
  },
  scopeText: { fontSize: 11, lineHeight: 18, color: "#526eaa" },
  reportTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#20334f",
    flexShrink: 1,
  },
  recordBadge: {
    borderRadius: 6,
    backgroundColor: "#edf0f6",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  table: { marginTop: 14 },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f5f7fc",
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#edf1f8",
  },
  cell: {
    width: 110,
    padding: 10,
    fontSize: 10,
    lineHeight: 17,
    color: "#405573",
  },
  columnTitle: { fontWeight: "700", fontSize: 9 },
  empty: { paddingVertical: 24 },
  loading: { marginVertical: 24 },
  navigation: {
    flexDirection: "row",
    paddingVertical: 8,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e4eaf5",
  },
  navItem: { flex: 1, alignItems: "center", gap: 3 },
  navIcon: {
    width: 46,
    height: 32,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  navGlyph: { fontSize: 22, color: "#71829c" },
  navLabel: { fontSize: 9, color: "#71829c" },
  overlay: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    backgroundColor: "rgba(27,43,68,0.3)",
  },
  modal: {
    padding: 22,
    width: "100%",
    maxWidth: 460,
    maxHeight: "85%",
    alignSelf: "center",
    borderRadius: 20,
    backgroundColor: "#fff",
  },
  close: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 17,
    borderBottomWidth: 1,
    borderBottomColor: "#edf1f8",
  },
});
