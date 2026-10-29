import { toast } from '../../../src/ui/toast-store';
import { DashboardWebHeader } from '../../../src/ui/DashboardWebHeader';
import { firstName } from '../../../src/shared/firstName';
import { useTimeGreeting } from '../../../src/ui/useTimeGreeting';
import { DashboardDateTimeCard } from '../../../src/ui/DashboardDateTimeCard';
import { getAvailableBranches } from "../../../src/core/admin/available-branches";
import { useDesktopStyles } from "../../../src/ui/useDesktopStyles";
import { AppIcon, type AppIconName } from "../../../src/ui/AppIcon";
import { SummaryMetrics, type SummaryMetric } from "../../../src/ui/SummaryMetrics";
import React, { useCallback, useState } from "react";

import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useWorkspaceFocusEffect as useFocusEffect } from '../../../src/core/admin/useWorkspaceFocusEffect';

import { AdminBottomNavigation } from "../../../src/ui/AdminBottomNavigation";
import { useAdminLayout } from "../../../src/ui/useAdminLayout";
import { useAdminViewport } from "../../../src/ui/useAdminViewport";

import { api } from "../../../src/core/api/client";

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
import { useAuth } from "../../../src/core/auth/AuthProvider";
import { canOpenAdminPath } from "../../../src/core/admin/access";
import { companyRoles } from '../../../src/core/admin/role-capabilities';

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
  onLeaveToday: number | null;
  branchSummary: { id: string; name: string; employees: number; present: number }[];
};

type Tone = "blue" | "green" | "purple" | "gold";

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
  onLeaveToday: null,
  branchSummary: [],
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

function QuickAction({
  title,
  displayTitle,
  symbol,
  icon,
  tone,
  onPress,
}: {
  title: string;
  displayTitle?: string;
  symbol: string;
  /** Optional named icon (same set as the sidebar); takes precedence over the text symbol. */
  icon?: AppIconName;
  hideLabel?: boolean;
  tone: Tone;
  onPress: () => void;
}) {
  const styles = useDesktopStyles(baseStyles);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      testID="dashboard-quick-action"
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
        {icon ? (
          <AppIcon name={icon} size={20} color={tones[tone].color} />
        ) : (
          <AppIcon
            symbol={symbol}
            style={[styles.quickSymbol, { color: tones[tone].color }]}
          />
        )}
      </View>

      <Text style={styles.quickLabel}>{displayTitle ?? title}</Text>
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
        <AppIcon
          symbol={symbol}
          style={[styles.workspaceSymbol, { color: tones[tone].color }]}
        />
      </View>

      <Text style={styles.workspaceTitle}>{title}</Text><Text style={styles.caption}>{description}</Text>

      

      <View style={styles.workspaceAction}>
        <Text style={[styles.workspaceLink, { color: tones[tone].color }]}>Open workspace</Text>
        <AppIcon name="chevron-right" size={16} color={tones[tone].color} />
      </View>
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
        <Text style={styles.rowTitle}>{title}</Text><Text style={styles.caption}>{subtitle}</Text>

        
      </View>

      <AppIcon symbol="›" style={styles.chevron} />
    </Pressable>
  );
}

// =====================================================
// ADMIN DASHBOARD
// =====================================================

export default function AdminDashboard() {
  const greeting = useTimeGreeting();
  const { session } = useAuth();
  const router = useRouter();
  const adminScope = useAdminScope();
  const canOpen = (path: string) =>
    canOpenAdminPath(session, adminScope?.companyId, path);
  const dashboardRoles = companyRoles(session, adminScope?.companyId);
  const isHrView = dashboardRoles.includes('HR_MANAGER') && !dashboardRoles.some(role => ['BUSINESS_OWNER', 'BUSINESS_ADMIN', 'COMPANY_MANAGER', 'BRANCH_MANAGER'].includes(role));

  const {
    styles: responsive,
    padding: horizontalPadding,
    contentWidth,
  } = useAdminLayout(baseStyles);

  const { desktop, width, fontScale } = useAdminViewport();
  const workspaceColumns = desktop
    ? fontScale > 1 ? Math.min(4, Math.max(1, Math.floor((contentWidth + 12) / (180 * fontScale + 12)))) : 4
    : 2;
  const dashboardCardWidth = Math.max(0, (contentWidth - (workspaceColumns - 1) * 12) / workspaceColumns);

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
          const membership = session?.memberships.find(item => item.companyId === scope.companyId);
          const roles = membership?.roles ?? [membership?.role ?? scope.role];
          const hasPermission = (key: string) => membership?.permissions.includes(key) ?? false;
          const businessAdmin = roles.some(role => ['BUSINESS_OWNER', 'BUSINESS_ADMIN', 'COMPANY_MANAGER', 'BRANCH_MANAGER', 'SALES_MANAGER'].includes(role));
          const canReadPeople = hasPermission('users.read');
          const canReadCrm = hasPermission('crm.read');
          const canReadAttendance = hasPermission('attendance.read');
          const canReadPayroll = hasPermission('payroll.read');

          // Request only modules assigned to this role. A missing module stays
          // unavailable instead of rendering a zero or a permission error.
          const branchesPromise = canReadPayroll ? getAvailableBranches() : Promise.resolve([]);

          const results = await Promise.allSettled([
            canReadPeople ? getEmployees() : Promise.resolve(null),

            businessAdmin ? api.get<DashboardTask[]>("/tasks", {
              params: {
                companyId: scope.companyId,
              },
            }) : Promise.resolve(null),

            // The Leads endpoint requires crm.read. The dashboard is also used
            // by HR/payroll managers who may not have CRM permissions.
            // Avoid an unauthorized request; never bypass the backend guard.
            canReadCrm ? leadsApi.list(scope.companyId) : Promise.resolve(null),

            roles.some(role => [
              "BUSINESS_OWNER",
              "BUSINESS_ADMIN",
              "COMPANY_MANAGER", "BRANCH_MANAGER",
              "HR_MANAGER",
            ].includes(role))
              ? leaveApi.requests(scope.companyId)
              : Promise.resolve(null),

            canReadAttendance ? attendanceApi.list({
              companyId: scope.companyId,
              fromDate: localDateKey(new Date()),
              toDate: localDateKey(new Date()),
            }) : Promise.resolve(null),

            canReadPayroll ? branchesPromise.then(async (branches) => {
              const activeBranches = branches.filter(
                (branch) =>
                  branch.status === "ACTIVE" &&
                  (!scope.branchId || branch.id === scope.branchId),
              );

              const periodsByBranch = await Promise.all(
                activeBranches.map((branch) =>
                  payrollApi.periods(scope.companyId, branch.id),
                ),
              );

              return periodsByBranch.flat();
            }) : Promise.resolve(null),
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
          let activeEmployeeList: { branchId?: string; branch: string }[] | null = null;

          if (employeeResult.status === "fulfilled" && employeeResult.value !== null) {
            activeEmployeeList = employeeResult.value.filter((employee) => employee.status === "active");
            next.activeEmployees = employeeResult.value.filter(
              (employee) => employee.status === "active" &&
                (!scope.branchId || employee.branchId === scope.branchId),
            ).length;
          } else if (employeeResult.status === "rejected") {
            nextErrors.push(
              `Employees: ${getErrorMessage(employeeResult.reason)}`,
            );
          }

          // -------------------------------------------
          // 2. TASK MANAGEMENT
          // -------------------------------------------

          const taskResult = results[1];

          if (taskResult.status === "fulfilled" && taskResult.value !== null) {
            if (!Array.isArray(taskResult.value.data)) {
              nextErrors.push("Tasks: Invalid API response.");
            } else {
              const tasks = taskResult.value.data.filter(
                (task) =>
                  task.companyId === scope.companyId &&
                  (!scope.branchId || task.branchId === scope.branchId),
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
          } else if (taskResult.status === "rejected") {
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
                (lead) =>
                  lead.stage !== "WON" &&
                  lead.stage !== "LOST" &&
                  (!scope.branchId || lead.branchId === scope.branchId),
              ).length;
            }
          } else {
            nextErrors.push(`CRM: ${getErrorMessage(leadResult.reason)}`);
          }

          // -------------------------------------------
          // 4. PENDING LEAVE REQUESTS
          // -------------------------------------------

          const leaveResult = results[3];

          if (
            leaveResult.status === "fulfilled" &&
            leaveResult.value !== null
          ) {
            next.pendingLeave = leaveResult.value.filter(
              (request) =>
                request.status === "PENDING" &&
                (!scope.branchId || request.branchId === scope.branchId),
            ).length;
            next.onLeaveToday = new Set(leaveResult.value.filter(
              (request) =>
                request.status === "APPROVED" &&
                request.startDate.slice(0, 10) <= today &&
                request.endDate.slice(0, 10) >= today &&
                (!scope.branchId || request.branchId === scope.branchId),
            ).map((request) => request.userId)).size;
          } else if (leaveResult.status === "rejected") {
            nextErrors.push(`Leave: ${getErrorMessage(leaveResult.reason)}`);
          }

          // -------------------------------------------
          // 5. TODAY'S ATTENDANCE
          // -------------------------------------------

          const attendanceResult = results[4];

          if (attendanceResult.status === "fulfilled" && attendanceResult.value !== null) {
            const presentUserIds = new Set(
              attendanceResult.value
                .filter(
                  (entry) =>
                    ["PRESENT", "HALF_DAY"].includes(entry.status) &&
                    entry.attendanceDate.slice(0, 10) === today &&
                    (!scope.branchId || entry.branchId === scope.branchId),
                )
                .map((entry) => entry.userId),
            );

            next.presentToday = presentUserIds.size;
            if (activeEmployeeList && !scope.branchId) {
              const presentByBranch = new Map<string, Set<string>>();
              for (const entry of attendanceResult.value) {
                if (!["PRESENT", "HALF_DAY"].includes(entry.status) || entry.attendanceDate.slice(0, 10) !== today) continue;
                if (!presentByBranch.has(entry.branchId)) presentByBranch.set(entry.branchId, new Set());
                presentByBranch.get(entry.branchId)!.add(entry.userId);
              }
              const byBranch = new Map<string, { id: string; name: string; employees: number; present: number }>();
              for (const employee of activeEmployeeList) {
                if (!employee.branchId) continue;
                const row = byBranch.get(employee.branchId) ?? { id: employee.branchId, name: employee.branch, employees: 0, present: 0 };
                row.employees += 1;
                byBranch.set(employee.branchId, row);
              }
              for (const row of byBranch.values()) row.present = presentByBranch.get(row.id)?.size ?? 0;
              next.branchSummary = [...byBranch.values()].sort((a, b) => a.name.localeCompare(b.name));
            }
          } else if (attendanceResult.status === "rejected") {
            nextErrors.push(
              `Attendance: ${getErrorMessage(attendanceResult.reason)}`,
            );
          }

          // -------------------------------------------
          // 6. PAYROLL SUMMARY
          // -------------------------------------------

          const payrollResult = results[5];

          if (payrollResult.status === "fulfilled" && payrollResult.value !== null) {
            try {
              const payroll = getLatestPayroll(payrollResult.value);

              next.payrollNet = payroll.total;
              next.payrollMonth = payroll.month;
            } catch (error) {
              nextErrors.push(`Payroll: ${getErrorMessage(error)}`);
            }
          } else if (payrollResult.status === "rejected") {
            nextErrors.push(
              `Payroll: ${getErrorMessage(payrollResult.reason)}`,
            );
          }

          setData(next);
          setErrors(nextErrors);
          if (nextErrors.length) toast.error(nextErrors.join("\n"));
        } catch (error) {
          if (active) {
            setErrors([getErrorMessage(error)]);
            toast.error(getErrorMessage(error));
          }
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      }

      const unsubscribe = subscribeAdminSelection(() => {
        if (active) void loadDashboard();
      });
      void loadDashboard();

      return () => {
        active = false;
        unsubscribe();
      };
    }, [reload]),
  );

  // ===================================================
  // OVERVIEW CARDS
  // ===================================================

  const overview: SummaryMetric[] = [
    {
      id: "active-employees",
      label: "Active employees",
      value: displayCount(data.activeEmployees),
      caption: "Active employee records",
      tone: "neutral",
      icon: "users",
      onPress: () => router.push("/admin/employees/active-employees"),
    },
    {
      id: "present-today",
      label: "Present today",
      value: displayCount(data.presentToday),
      caption: "Attendance Marked here",
      tone: "success",
      icon: "check-circle",
      onPress: () => router.push("/admin/attendance"),
    },
    {
      id: "pending-leave",
      label: "Pending leave",
      value: displayCount(data.pendingLeave),
      caption: "Requests awaiting review",
      tone: "warning",
      icon: "clock",
      onPress: () => router.push("/admin/approvals"),
    },
    {
      id: "on-leave",
      label: "On leave today",
      value: displayCount(data.onLeaveToday),
      caption: "Approved leave covering today",
      tone: "purple",
      icon: "calendar",
      onPress: () => router.push("/admin/approvals"),
    },
    {
      id: "open-crm-leads",
      label: "Open CRM leads",
      value: displayCount(data.openLeads),
      caption: "Leads not marked won or lost",
      tone: "purple",
      icon: "trending-up",
      onPress: () => router.push("/admin/crm"),
    },
    {
      id: "open-tasks",
      label: "Open tasks",
      value: displayCount(data.openTasks),
      caption: "Awaiting completion",
      tone: "neutral",
      icon: "list",
      onPress: () => router.push("/admin/tasks/follow-ups"),
    },
    {
      id: "completed-tasks",
      label: "Completed tasks",
      value: displayCount(data.completedTasks),
      caption: "Completed team tasks",
      tone: "success",
      icon: "check-circle",
      onPress: () => router.push("/admin/tasks/follow-ups"),
    },
    {
      id: "tasks-due-today",
      label: "Tasks due today",
      value: displayCount(data.dueToday),
      caption: "Open tasks with today’s due date",
      tone: "warning",
      icon: "clock",
      onPress: () => router.push("/admin/tasks/follow-ups"),
    },
    {
      id: "net-payroll",
      label: "Net payroll run total",
      value: displayMoney(data.payrollNet, data.payrollCurrency),
      caption: data.payrollMonth
        ? `Calculated runs · ${data.payrollMonth}`
        : "No calculated payroll runs",
      tone: "purple",
      icon: "credit-card",
      onPress: () => router.push("/admin/payroll"),
    },
  ];

  // ===================================================
  // UI
  // ===================================================

  return (
    <SafeAreaView edges={["left", "right"]} style={responsive.safe}>
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

          {Platform.OS === 'web' ? <DashboardWebHeader
            greeting={`${greeting}, ${firstName(adminScope?.user.name || session?.user.name)}`}
            onRefresh={width <= 320 ? undefined : () => setReload(value => value + 1)} refreshing={loading}
          /> : <View>
            <View style={[responsive.between, { flexWrap: 'wrap', gap: 12 }]}>
              <Text
                style={[
                  responsive.greeting,
                  { flexGrow: 1, flexShrink: 1, flexBasis: 160, minWidth: 0, marginTop: 0 },
                  width / fontScale < 520 && { fontSize: 19, lineHeight: 26 },
                ]}
              >
                {greeting}, {firstName(adminScope?.user.name || session?.user.name)}
              </Text>
              <DashboardDateTimeCard />
            </View>
            
          </View>}

          {/* QUICK ACTIONS */}

          <View testID="dashboard-quick-actions" style={responsive.quickActions}>
            {canOpen("/admin/employees/create") && (
              <QuickAction
                title="Add employee"
                displayTitle={!desktop ? "Add" : undefined}
                symbol="+"
                icon="users"
                tone="blue"
                onPress={() => router.push("/admin/employees/create")}
              />
            )}

            {!canOpen("/admin/employees/create") && canOpen("/admin/employees") && (
              <QuickAction
                title="Employees"
                symbol="+"
                icon="users"
                tone="blue"
                onPress={() => router.push("/admin/employees")}
              />
            )}

            {canOpen("/admin/crm/lead-form") && (
              <QuickAction
                title="Add lead"
                symbol="↗"
                tone="green"
                onPress={() => router.push("/admin/crm/lead-form")}
              />
            )}

            {canOpen("/admin/tasks") && (
              <QuickAction
                title="Assign task"
                symbol="☑"
                tone="purple"
                onPress={() => router.push("/admin/tasks")}
              />
            )}

            <QuickAction
              title="Attendance"
              symbol="◷"
              tone="gold"
              onPress={() => router.push("/admin/attendance")}
            />
          </View>

          {/* DASHBOARD METRICS */}

          <View style={responsive.sectionHeading}>
            <Text style={responsive.sectionHeadingText}>At a Glance</Text>

            {Platform.OS !== 'web' && <Pressable
              accessibilityRole="button"
              onPress={() => setReload((value) => value + 1)}
              style={responsive.refreshButton}
            >
              <Text style={responsive.refreshText}>Refresh</Text>
            </Pressable>}
          </View>

          {errors.length > 0 && (
            <View style={responsive.errorCard}>
              {errors.map((error, index) => (
                <Text key={`${index}-${error}`} style={responsive.errorText}>
                  {error}
                </Text>
              ))}
            </View>
          )}

          <SummaryMetrics centerContent={false}
            testID="dashboard-overview"
            variant="plain"
            items={overview.filter(item => {
              // On-leave is the HR manager's own at-a-glance card (it mirrors the pending-leave one for others).
              if (item.id === 'on-leave' && !isHrView) return false;
              const route = item.id === 'active-employees' ? '/admin/employees'
                : item.id === 'present-today' ? '/admin/attendance/team'
                : item.id === 'pending-leave' || item.id === 'on-leave' ? '/admin/approvals'
                : item.id === 'open-crm-leads' ? '/admin/crm'
                : item.id === 'net-payroll' ? '/admin/payroll'
                : '/admin/tasks/follow-ups';
              return canOpen(route);
            })}
            loading={loading}
          />

          {/* WORKSPACES */}

          <Text style={responsive.sectionTitle}>Your workspaces</Text>

          <View style={responsive.grid}>
            {canOpen("/admin/crm") && (
              <View
                style={{
                  width: dashboardCardWidth,
                }}
              >
                <WorkspaceCard
                  title="CRM"
                  description="Leads, deals and customers"
                  symbol="↗"
                  tone="blue"
                  onPress={() => router.push("/admin/crm")}
                />
              </View>
            )}

            {canOpen("/admin/payroll") && (
              <View
                style={{
                  width: dashboardCardWidth,
                }}
              >
                <WorkspaceCard
                  title="Payroll"
                  description="Salary runs and employee payments"
                  symbol="₹"
                  tone="purple"
                  onPress={() => router.push("/admin/payroll")}
                />
              </View>
            )}
            {canOpen("/admin/employees") && <View style={{ width: dashboardCardWidth }}>
              <WorkspaceCard
                title="People"
                description="Employees, attendance and leave"
                symbol="users"
                tone="green"
                onPress={() => router.push("/admin/employees/people")}
              />
            </View>}

            {canOpen("/admin/reports") && <View
              style={{
                width: dashboardCardWidth,
              }}
            >
              <WorkspaceCard
                title="Reports"
                description="Business reports and insights"
                symbol="▤"
                tone="gold"
                onPress={() => router.push("/admin/reports")}
              />
            </View>}
          </View>

          {/* NEEDS ATTENTION */}

          <Text style={responsive.sectionTitle}>Needs attention</Text>

          <View style={[responsive.list, { width: '100%', paddingHorizontal: 0 }]}>
            {canOpen("/admin/approvals") && (
              <ActionRow
                title="Leave requests to review"
                subtitle={`${displayCount(data.pendingLeave)} pending requests`}
                symbol="◷"
                onPress={() => router.push("/admin/approvals")}
              />
            )}

            {canOpen("/admin/payroll") && (
              <ActionRow
                title="Payroll checks"
                subtitle={data.payrollMonth ? `Latest payroll · ${data.payrollMonth}` : 'No calculated payroll runs'}
                symbol="₹"
                onPress={() => router.push("/admin/payroll")}
              />
            )}

            {canOpen("/admin/tasks/follow-ups") && <ActionRow
              title="Employee tasks and follow-ups"
              subtitle={`${displayCount(data.openTasks)} open tasks`}
              symbol="☷"
              onPress={() => router.push("/admin/tasks/follow-ups")}
            />}

            {canOpen("/admin/crm") && (
              <ActionRow
                title="CRM pipeline"
                subtitle={`${displayCount(data.openLeads)} open leads`}
                symbol="↗"
                onPress={() => router.push("/admin/crm")}
              />
            )}
          </View>

          {/* BRANCH OVERVIEW */}

          {!loading && data.branchSummary.length > 1 && canOpen("/admin/employees") && (
            <>
              <Text style={responsive.sectionTitle}>Branch overview</Text>
              <View style={responsive.grid}>
                {data.branchSummary.map((branch) => {
                  const percent = branch.employees ? Math.round((branch.present / branch.employees) * 100) : 0;
                  return (
                    <View key={branch.id} style={[responsive.branchSummaryCard, { width: dashboardCardWidth }]}>
                      <Text numberOfLines={1} style={responsive.rowTitle}>{branch.name}</Text>
                      <Text style={responsive.branchSummaryValue}>{branch.employees}</Text>
                      <Text style={responsive.caption}>Employees</Text>
                      <Text style={responsive.caption}>{branch.present} present today · {percent}%</Text>
                    </View>
                  );
                })}
              </View>
            </>
          )}
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
    lineHeight: 21,
    color: "#607591",
    marginTop: 8,
    maxWidth: 520,
    textAlign: "left",
  },

  quickActions: {
    flexDirection: "row",
    flexWrap: "nowrap",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e4eaf5",
    borderRadius: 18,
    paddingVertical: 8,
    marginTop: 20,
  },

  quickAction: {
    // Fewer permitted actions share the full row instead of leaving an empty gap.
    flexBasis: 0,
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
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
    alignItems: "stretch",
    gap: 12,
  },

  metric: {
    minHeight: 154,
    borderRadius: 16,
    padding: 15,
    alignItems: "flex-start",
    justifyContent: "center",
    paddingVertical: 16,
    minWidth: 0,
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
    textAlign: "left",
    flexShrink: 1,
  },

  metricValue: {
    fontSize: 23,
    fontWeight: "800",
    color: "#263246",
    marginTop: 4,
    textAlign: "left",
    flexShrink: 1,
  },

  chevron: {
    color: "#a6aebb",
    fontSize: 20,
  },

  workspace: {
    flex: 1,
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

  workspaceAction: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: 8, marginTop: 'auto', paddingTop: 18,
  },
  workspaceLink: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: "700",
  },

  list: {
    gap: 11,
    marginBottom: 20,
  },

  branchSummaryCard: {
    padding: 16,
    gap: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e4eaf5",
    backgroundColor: "#ffffff",
  },

  branchSummaryValue: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "700",
    color: "#20334f",
  },

  actionRow: {
    width: '100%',
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
