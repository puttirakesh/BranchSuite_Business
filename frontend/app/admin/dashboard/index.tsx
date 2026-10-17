import { getAvailableBranches } from "../../../src/core/admin/available-branches";
import { useDesktopStyles } from "../../../src/ui/useDesktopStyles";
import { AppIcon } from "../../../src/ui/AppIcon";
import React, { useCallback, useState } from "react";

import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";

import { AdminBottomNavigation } from "../../../src/ui/AdminBottomNavigation";
import { useAdminLayout } from "../../../src/ui/useAdminLayout";
import { useAdminViewport } from "../../../src/ui/useAdminViewport";

import { api, getSessionApi } from "../../../src/core/api/client";

import {
  attendanceApi,
  leadsApi,
  leaveApi,
  payrollApi,
  type PayrollPeriodDto,
} from "../../../src/core/admin/api";

import {
  getAdminScope,
  useAdminScope,
  subscribeAdminSelection,
} from "../../../src/core/admin/scope";

import { getEmployees } from "../../../src/core/employees";
import { useAuth } from '../../../src/core/auth/AuthProvider';
import { canOpenAdminPath } from '../../../src/core/admin/access';

// =====================================================
// TYPES
// =====================================================

type TaskStatus =
  | "TODO"
  | "IN_PROGRESS"
  | "ON_HOLD"
  | "COMPLETED"
  | "CANCELLED";

type DashboardTask = {
  id: string;
  companyId: string;
  branchId: string;
  title: string;
  status: TaskStatus;
  dueDate: string | null;
};

type DashboardData = {
  activeEmployees: number | null;
  presentToday: number | null;
  pendingLeave: number | null;
  openLeads: number | null;
  openTasks: number | null;
  completedTasks: number | null;
  dueToday: number | null;
  payrollNet: number | null;
  payrollMonth: string | null;
  payrollCurrency: string;
};

type Tone = "blue" | "green" | "purple" | "gold";

type MetricCard = {
  label: string;
  value: string;
  caption: string;
  symbol: string;
  tone: Tone;
  onPress: () => void;
};

const tones: Record<Tone, { color: string; background: string }> = {
  blue: {
    color: "#345cf2",
    background: "#edf1ff",
  },
  green: {
    color: "#138f80",
    background: "#e6f4ee",
  },
  purple: {
    color: "#8b5cf6",
    background: "#f1eafa",
  },
  gold: {
    color: "#aa690e",
    background: "#fff1d9",
  },
};

const EMPTY_DATA: DashboardData = {
  activeEmployees: null,
  presentToday: null,
  pendingLeave: null,
  openLeads: null,
  openTasks: null,
  completedTasks: null,
  dueToday: null,
  payrollNet: null,
  payrollMonth: null,
  payrollCurrency: "INR",
};

// =====================================================
// HELPERS
// =====================================================

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function isDueToday(dateValue: string | null, todayKey: string): boolean {
  if (!dateValue) return false;

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return localDateKey(date) === todayKey;
}

function isOpenTask(status: TaskStatus): boolean {
  return status === "TODO" || status === "IN_PROGRESS" || status === "ON_HOLD";
}

function displayCount(value: number | null): string {
  return value === null ? "—" : value.toLocaleString("en-IN");
}

function displayMoney(value: number | null, currency: string): string {
  if (value === null) return "—";

  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unable to load data from the server.";
}

function getLatestPayroll(periods: PayrollPeriodDto[]): {
  total: number;
  month: string | null;
} {
  const calculated = periods.filter(
    (period) =>
      period.run !== null &&
      ["CALCULATED", "APPROVED", "PAID"].includes(period.run.status),
  );

  if (calculated.length === 0) {
    return { total: 0, month: null };
  }

  const latest = [...calculated].sort(
    (a, b) => b.year - a.year || b.month - a.month,
  )[0];

  const sameMonth = calculated.filter(
    (period) => period.year === latest.year && period.month === latest.month,
  );

  const amounts = sameMonth.map((period) => Number(period.run!.netTotal));

  if (amounts.some((amount) => !Number.isFinite(amount))) {
    throw new Error("Invalid payroll amount received.");
  }

  const total = amounts.reduce((sum, amount) => sum + amount, 0);

  const month = new Date(latest.year, latest.month - 1, 1).toLocaleDateString(
    "en-IN",
    {
      month: "short",
      year: "numeric",
    },
  );

  return { total, month };
}

// =====================================================
// SHARED VISUAL COMPONENTS
// =====================================================

function MetricTile({ item }: { item: MetricCard }) {
  const styles = useDesktopStyles(baseStyles);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.label}
      onPress={item.onPress}
      style={[
        styles.metric,
        {
          backgroundColor: tones[item.tone].background,
        },
      ]}
    >
      <View style={styles.between}>
        <View style={styles.metricIcon}>
          <AppIcon symbol={item.symbol} style={[styles.metricSymbol, { color: tones[item.tone].color }]} />
        </View>

        <AppIcon symbol="›" style={styles.chevron} />
      </View>

      <Text style={styles.metricLabel}>{item.label}</Text>

      <Text style={styles.metricValue} numberOfLines={2} adjustsFontSizeToFit>
        {item.value}
      </Text>

      <Text style={styles.caption}>{item.caption}</Text>
    </Pressable>
  );
}

function QuickAction({
  title,
  symbol,
  tone,
  onPress,
}: {
  title: string;
  symbol: string;
  tone: Tone;
  onPress: () => void;
}) {
  const styles = useDesktopStyles(baseStyles);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={styles.quickAction}
    >
      <View
        style={[
          styles.quickIcon,
          {
            backgroundColor: tones[tone].background,
          },
        ]}
      >
        <AppIcon symbol={symbol} style={[styles.quickSymbol, { color: tones[tone].color }]} />
      </View>

      <Text style={styles.quickLabel}>{title}</Text>
    </Pressable>
  );
}

function WorkspaceCard({
  title,
  description,
  symbol,
  tone,
  onPress,
}: {
  title: string;
  description: string;
  symbol: string;
  tone: Tone;
  onPress: () => void;
}) {
  const styles = useDesktopStyles(baseStyles);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${title}`}
      onPress={onPress}
      style={styles.workspace}
    >
      <View
        style={[
          styles.workspaceIcon,
          {
            backgroundColor: tones[tone].background,
          },
        ]}
      >
        <AppIcon symbol={symbol} style={[styles.workspaceSymbol, { color: tones[tone].color }]} />
      </View>

      <Text style={styles.workspaceTitle}>{title}</Text>

      <Text style={styles.caption}>{description}</Text>

      <Text style={[styles.workspaceLink, { color: tones[tone].color }]}>
        Open workspace <AppIcon symbol="›" size={16} />
      </Text>
    </Pressable>
  );
}

function ActionRow({
  title,
  subtitle,
  symbol,
  onPress,
}: {
  title: string;
  subtitle: string;
  symbol: string;
  onPress: () => void;
}) {
  const styles = useDesktopStyles(baseStyles);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={styles.actionRow}
    >
      <AppIcon symbol={symbol} style={styles.actionIcon} />

      <View style={styles.actionText}>
        <Text style={styles.rowTitle}>{title}</Text>

        <Text style={styles.caption}>{subtitle}</Text>
      </View>

      <AppIcon symbol="›" style={styles.chevron} />
    </Pressable>
  );
}

// =====================================================
// ADMIN DASHBOARD
// =====================================================

export default function AdminDashboard() {
  const { session } = useAuth();
  const router = useRouter();
  const adminScope = useAdminScope();
  const canOpen = (path: string) => canOpenAdminPath(session, adminScope?.companyId, path);

  const {
    styles: responsive,
    padding: horizontalPadding,
    overviewGrid,
  } = useAdminLayout(baseStyles);

  const { desktop } = useAdminViewport();

  const [data, setData] = useState<DashboardData>(EMPTY_DATA);

  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const [reload, setReload] = useState(0);

  // ===================================================
  // LOAD DASHBOARD METRICS
  // ===================================================

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function loadDashboard() {
        setLoading(true);
        setErrors([]);
        setData(EMPTY_DATA);

        try {
          const scope = await getAdminScope();

          // All requests reuse existing business APIs.
          const branchesPromise = getAvailableBranches();

          const results = await Promise.allSettled([
            getEmployees(),

            api.get<DashboardTask[]>("/tasks", {
              params: {
                companyId: scope.companyId,
              },
            }),

            // The Leads endpoint requires crm.read. The dashboard is also used
            // by HR/payroll managers who may not have CRM permissions.
            // Avoid an unauthorized request; never bypass the backend guard.
            getSessionApi().then((session) => {
              const canReadCrm = session.memberships.some((membership) =>
                membership.permissions.includes("crm.read"),
              );
              return canReadCrm ? leadsApi.list(scope.companyId) : null;
            }),

            ['BUSINESS_OWNER', 'BUSINESS_ADMIN', 'BRANCH_MANAGER', 'HR_MANAGER'].includes(scope.role) ? leaveApi.requests(scope.companyId) : null,

            attendanceApi.list({
              companyId: scope.companyId,
              fromDate: localDateKey(new Date()),
              toDate: localDateKey(new Date()),
            }),

            branchesPromise.then(async (branches) => {
              if (!['BUSINESS_OWNER', 'BUSINESS_ADMIN', 'PAYROLL_MANAGER'].includes(scope.role)) return [];
              const activeBranches = branches.filter(
                (branch) => branch.status === "ACTIVE" && (!scope.branchId || branch.id === scope.branchId),
              );

              const periodsByBranch = await Promise.all(
                activeBranches.map((branch) =>
                  payrollApi.periods(scope.companyId, branch.id),
                ),
              );

              return periodsByBranch.flat();
            }),
          ] as const);

          if (!active) return;

          const next: DashboardData = {
            ...EMPTY_DATA,
          };

          const nextErrors: string[] = [];
          const today = localDateKey(new Date());

          // -------------------------------------------
          // 1. ACTIVE EMPLOYEES
          // -------------------------------------------

          const employeeResult = results[0];

          if (employeeResult.status === "fulfilled") {
            next.activeEmployees = employeeResult.value.filter(
              (employee) => employee.status === "active",
            ).length;
          } else {
            nextErrors.push(
              `Employees: ${getErrorMessage(employeeResult.reason)}`,
            );
          }

          // -------------------------------------------
          // 2. TASK MANAGEMENT
          // -------------------------------------------

          const taskResult = results[1];

          if (taskResult.status === "fulfilled") {
            if (!Array.isArray(taskResult.value.data)) {
              nextErrors.push("Tasks: Invalid API response.");
            } else {
              const tasks = taskResult.value.data.filter(
                (task) => task.companyId === scope.companyId && (!scope.branchId || task.branchId === scope.branchId),
              );

              next.openTasks = tasks.filter((task) =>
                isOpenTask(task.status),
              ).length;

              next.completedTasks = tasks.filter(
                (task) => task.status === "COMPLETED",
              ).length;

              next.dueToday = tasks.filter(
                (task) =>
                  isOpenTask(task.status) && isDueToday(task.dueDate, today),
              ).length;
            }
          } else {
            nextErrors.push(`Tasks: ${getErrorMessage(taskResult.reason)}`);
          }

          // -------------------------------------------
          // 3. CRM LEADS
          // -------------------------------------------

          const leadResult = results[2];

          if (leadResult.status === "fulfilled") {
            // Missing crm.read means the count is unavailable, not zero.
            if (leadResult.value !== null) {
              next.openLeads = leadResult.value.filter(
                (lead) => lead.stage !== "WON" && lead.stage !== "LOST" && (!scope.branchId || lead.branchId === scope.branchId),
              ).length;
            }
          } else {
            nextErrors.push(`CRM: ${getErrorMessage(leadResult.reason)}`);
          }

          // -------------------------------------------
          // 4. PENDING LEAVE REQUESTS
          // -------------------------------------------

          const leaveResult = results[3];

          if (leaveResult.status === "fulfilled" && leaveResult.value !== null) {
            next.pendingLeave = leaveResult.value.filter(
              (request) => request.status === "PENDING" && (!scope.branchId || request.branchId === scope.branchId),
            ).length;
          } else if (leaveResult.status === 'rejected') {
            nextErrors.push(`Leave: ${getErrorMessage(leaveResult.reason)}`);
          }

          // -------------------------------------------
          // 5. TODAY'S ATTENDANCE
          // -------------------------------------------

          const attendanceResult = results[4];

          if (attendanceResult.status === "fulfilled") {
            const presentUserIds = new Set(
              attendanceResult.value
                .filter(
                  (entry) =>
                    ["PRESENT", "HALF_DAY"].includes(entry.status) &&
                    entry.attendanceDate.slice(0, 10) === today && (!scope.branchId || entry.branchId === scope.branchId),
                )
                .map((entry) => entry.userId),
            );

            next.presentToday = presentUserIds.size;
          } else {
            nextErrors.push(
              `Attendance: ${getErrorMessage(attendanceResult.reason)}`,
            );
          }

          // -------------------------------------------
          // 6. PAYROLL SUMMARY
          // -------------------------------------------

          const payrollResult = results[5];

          if (payrollResult.status === "fulfilled") {
            try {
              const payroll = getLatestPayroll(payrollResult.value);

              next.payrollNet = payroll.total;
              next.payrollMonth = payroll.month;
            } catch (error) {
              nextErrors.push(`Payroll: ${getErrorMessage(error)}`);
            }
          } else {
            nextErrors.push(
              `Payroll: ${getErrorMessage(payrollResult.reason)}`,
            );
          }

          setData(next);
          setErrors(nextErrors);
        } catch (error) {
          if (active) {
            setErrors([getErrorMessage(error)]);
          }
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      }

      const unsubscribe = subscribeAdminSelection(() => { if (active) void loadDashboard(); });
      void loadDashboard();

      return () => {
        active = false;
        unsubscribe();
      };
    }, [reload]),
  );

  const dateLabel = new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  // ===================================================
  // OVERVIEW CARDS
  // ===================================================

  const overview: MetricCard[] = [
    {
      label: "Active employees",
      value: displayCount(data.activeEmployees),
      caption: "Active employee records",
      tone: "blue",
      symbol: "♙",
      onPress: () => router.push("/admin/employees/active-employees"),
    },
    {
      label: "Present today",
      value: displayCount(data.presentToday),
      caption: "Present and half-day attendance",
      tone: "green",
      symbol: "✓",
      onPress: () => router.push("/admin/attendance"),
    },
    {
      label: "Pending leave",
      value: displayCount(data.pendingLeave),
      caption: "Requests awaiting review",
      tone: "gold",
      symbol: "◷",
      onPress: () => router.push("/admin/approvals"),
    },
    {
      label: "Open CRM leads",
      value: displayCount(data.openLeads),
      caption: "Leads not marked won or lost",
      tone: "purple",
      symbol: "↗",
      onPress: () => router.push("/admin/crm"),
    },
    {
      label: "Open tasks",
      value: displayCount(data.openTasks),
      caption: "Tasks awaiting completion",
      tone: "blue",
      symbol: "☷",
      onPress: () => router.push("/admin/tasks/follow-ups"),
    },
    {
      label: "Completed tasks",
      value: displayCount(data.completedTasks),
      caption: "Completed team tasks",
      tone: "green",
      symbol: "✓",
      onPress: () => router.push("/admin/tasks/follow-ups"),
    },
    {
      label: "Tasks due today",
      value: displayCount(data.dueToday),
      caption: "Open tasks with today’s due date",
      tone: "gold",
      symbol: "◷",
      onPress: () => router.push("/admin/tasks/follow-ups"),
    },
    {
      label: "Net payroll run total",
      value: displayMoney(data.payrollNet, data.payrollCurrency),
      caption: data.payrollMonth
        ? `Calculated runs · ${data.payrollMonth}`
        : "No calculated payroll runs",
      tone: "purple",
      symbol: "₹",
      onPress: () => router.push("/admin/payroll"),
    },
  ];

  // ===================================================
  // UI
  // ===================================================

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={responsive.safe}>
      <View style={responsive.page}>
        <ScrollView
          style={responsive.scroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            responsive.content,
            {
              paddingHorizontal: horizontalPadding,
            },
          ]}
        >
          {/* BUSINESS OVERVIEW */}

          <View style={responsive.between}>
            <View style={responsive.headingBlock}>
              <Text style={responsive.eyebrow}>BUSINESS OVERVIEW</Text>

              <Text style={responsive.greeting}>Hello, {adminScope?.user.name?.trim() || "Admin"}</Text>

              <Text style={responsive.subtitle}>
                Your employees, customers, attendance and work priorities.
              </Text>
            </View>

            <View style={responsive.dateBadge}>
              <Text style={responsive.dateValue}>{dateLabel}</Text>

              <Text style={responsive.dateCaption}>Today</Text>
            </View>
          </View>

          {/* QUICK ACTIONS */}

          <View style={responsive.quickActions}>
            {canOpen('/admin/employees/create') && <QuickAction
              title="Add employee"
              symbol="+"
              tone="blue"
              onPress={() => router.push("/admin/employees/create")}
            />}

            {canOpen('/admin/crm/lead-form') && <QuickAction
              title="Add lead"
              symbol="↗"
              tone="green"
              onPress={() => router.push("/admin/crm/lead-form")}
            />}

            {canOpen('/admin/tasks') && <QuickAction
              title="Assign task"
              symbol="☑"
              tone="purple"
              onPress={() => router.push("/admin/tasks")}
            />}

            <QuickAction
              title="Attendance"
              symbol="◷"
              tone="gold"
              onPress={() => router.push("/admin/attendance")}
            />
          </View>

          {/* DASHBOARD METRICS */}

          <View style={responsive.sectionHeading}>
            <Text style={responsive.sectionHeadingText}>At a glance</Text>

            <Pressable
              accessibilityRole="button"
              onPress={() => setReload((value) => value + 1)}
              style={responsive.refreshButton}
            >
              <Text style={responsive.refreshText}>Refresh</Text>
            </Pressable>
          </View>

          {loading && (
            <View style={responsive.loading}>
              <ActivityIndicator color="#345cf2" />

              <Text style={responsive.caption}>Loading business data...</Text>
            </View>
          )}

          {errors.length > 0 && (
            <View style={responsive.errorCard}>
              {errors.map((error, index) => (
                <Text key={`${index}-${error}`} style={responsive.errorText}>
                  {error}
                </Text>
              ))}
            </View>
          )}

          <View style={responsive.grid}>
            {overview.filter(item => item.label === 'Open leads' ? canOpen('/admin/crm') : item.label === 'Net payroll run total' ? canOpen('/admin/payroll') : item.label === 'Pending leave' ? canOpen('/admin/approvals') : true).map((item) => (
              <View
                key={item.label}
                style={{
                  width: overviewGrid.cardWidth,
                }}
              >
                <MetricTile item={item} />
              </View>
            ))}
          </View>

          {/* WORKSPACES */}

          <Text style={responsive.sectionTitle}>Your workspaces</Text>

          <View style={responsive.grid}>
            {canOpen('/admin/crm') && <View
              style={{
                width: overviewGrid.cardWidth,
              }}
            >
              <WorkspaceCard
                title="CRM"
                description="Leads, deals and customers"
                symbol="↗"
                tone="blue"
                onPress={() => router.push("/admin/crm")}
              />
            </View>}

            {canOpen('/admin/payroll') && <View
              style={{
                width: overviewGrid.cardWidth,
              }}
            >
              <WorkspaceCard
                title="Payroll"
                description="Salary runs and employee payments"
                symbol="₹"
                tone="purple"
                onPress={() => router.push("/admin/payroll")}
              />
            </View>}
            <View style={{ width: overviewGrid.cardWidth }}><WorkspaceCard title="People" description="Employees, attendance and leave" symbol="users" tone="green" onPress={() => router.push('/admin/employees/people')} /></View>

            <View
              style={{
                width: overviewGrid.cardWidth,
              }}
            >
              <WorkspaceCard
                title="Reports"
                description="Business reports and insights"
                symbol="▤"
                tone="gold"
                onPress={() => router.push("/admin/reports")}
              />
            </View>
          </View>

          {/* NEEDS ATTENTION */}

          <Text style={responsive.sectionTitle}>Needs attention</Text>

          <View style={responsive.list}>
            {canOpen('/admin/approvals') && <ActionRow
              title="Leave requests to review"
              subtitle={`${displayCount(data.pendingLeave)} pending requests`}
              symbol="◷"
              onPress={() => router.push("/admin/approvals")}
            />}

            {canOpen('/admin/payroll') && <ActionRow
              title="Payroll checks"
              subtitle={
                data.payrollMonth
                  ? `Latest payroll run: ${data.payrollMonth}`
                  : "Review payroll periods and calculations"
              }
              symbol="₹"
              onPress={() => router.push("/admin/payroll")}
            />}

            <ActionRow
              title="Employee tasks and follow-ups"
              subtitle={`${displayCount(data.openTasks)} open tasks`}
              symbol="☷"
              onPress={() => router.push("/admin/tasks/follow-ups")}
            />

            {canOpen('/admin/crm') && <ActionRow
              title="CRM pipeline"
              subtitle={`${displayCount(data.openLeads)} open leads`}
              symbol="↗"
              onPress={() => router.push("/admin/crm")}
            />}
          </View>
        </ScrollView>

        <AdminBottomNavigation />
      </View>
    </SafeAreaView>
  );
}

// =====================================================
// STYLES
// =====================================================

const baseStyles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#f6f7fb",
  },

  page: {
    flex: 1,
    width: "100%",
    maxWidth: 1280,
    alignSelf: "center",
    minHeight: 0,
  },

  scroll: {
    flex: 1,
    minHeight: 0,
  },

  content: {
    paddingTop: 26,
    paddingBottom: 36,
  },

  between: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  header: {
    paddingTop: 12,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#eef0f6",
  },

  companyName: {
    fontSize: 16,
    fontWeight: "800",
    color: "#263246",
  },

  caption: {
    fontSize: 11,
    lineHeight: 17,
    color: "#8e97a8",
    marginTop: 4,
  },

  avatar: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#eaf0ff",
    alignItems: "center",
    justifyContent: "center",
  },

  avatarText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#345cf2",
  },

  headingBlock: {
    flex: 1,
    minWidth: 0,
  },

  eyebrow: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2,
    color: "#9099ac",
  },

  greeting: {
    fontSize: 29,
    fontWeight: "800",
    color: "#263246",
    marginTop: 7,
  },

  subtitle: {
    fontSize: 13,
    lineHeight: 20,
    color: "#8e97a8",
    marginTop: 5,
  },

  dateBadge: {
    alignItems: "center",
    padding: 10,
    borderRadius: 12,
    backgroundColor: "#ffffff",
  },

  dateValue: {
    fontSize: 11,
    fontWeight: "700",
    color: "#263246",
  },

  dateCaption: {
    fontSize: 9,
    color: "#8e97a8",
    marginTop: 3,
  },

  quickActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e4eaf5",
    borderRadius: 18,
    paddingVertical: 8,
    marginTop: 20,
  },

  quickAction: {
    width: "25%",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 3,
  },

  quickIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },

  quickSymbol: {
    fontSize: 19,
    fontWeight: "700",
  },

  quickLabel: {
    fontSize: 10,
    textAlign: "center",
    fontWeight: "600",
    color: "#20334f",
  },

  sectionHeading: {
    marginTop: 26,
    marginBottom: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  sectionHeadingText: {
    fontSize: 17,
    fontWeight: "800",
    color: "#263246",
  },

  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#263246",
    marginTop: 26,
    marginBottom: 14,
  },

  refreshButton: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 9,
    backgroundColor: "#eaf0ff",
  },

  refreshText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#345cf2",
  },

  loading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },

  errorCard: {
    backgroundColor: "#fff5f5",
    padding: 13,
    borderRadius: 12,
    marginBottom: 12,
  },

  errorText: {
    fontSize: 11,
    color: "#b94d61",
    marginBottom: 5,
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },

  metric: {
    minHeight: 154,
    borderRadius: 16,
    padding: 15,
  },

  metricIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.65)",
    alignItems: "center",
    justifyContent: "center",
  },

  metricSymbol: {
    fontSize: 21,
  },

  metricLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#737f91",
    marginTop: 10,
  },

  metricValue: {
    fontSize: 23,
    fontWeight: "800",
    color: "#263246",
    marginTop: 4,
  },

  chevron: {
    color: "#a6aebb",
    fontSize: 20,
  },

  workspace: {
    minHeight: 173,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    padding: 15,
  },

  workspaceIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },

  workspaceSymbol: {
    fontSize: 22,
  },

  workspaceTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#263246",
    marginTop: 12,
  },

  workspaceLink: {
    marginTop: 18,
    fontSize: 12,
    fontWeight: "700",
  },

  list: {
    gap: 11,
    marginBottom: 20,
  },

  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    paddingHorizontal: 15,
    paddingVertical: 17,
  },

  actionIcon: {
    width: 30,
    fontSize: 22,
    color: "#345cf2",
  },

  actionText: {
    flex: 1,
    minWidth: 0,
  },

  rowTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#263246",
  },
});
