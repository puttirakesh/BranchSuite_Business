import { firstName } from '../../../src/shared/firstName';
import { formatMoney } from '../../../src/features/employee/payslips';
import { useToastState } from "../../../src/ui/useToastState";
import { useTimeGreeting } from "../../../src/ui/useTimeGreeting";
import { DashboardDateTimeCard } from "../../../src/ui/DashboardDateTimeCard";
import { DashboardWebHeader } from '../../../src/ui/DashboardWebHeader';
import { SectionBranchSelect } from '../../../src/ui/SectionBranchSelect';
import { apiErrorMessage } from "../../../src/core/admin/http";
import { AppIcon } from "../../../src/ui/AppIcon";
import { SummaryMetrics } from "../../../src/ui/SummaryMetrics";

import React, { useCallback, useMemo, useState } from "react";

import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { useFocusEffect, useRouter } from "expo-router";

import axios from "axios";

import { api } from "../../../src/core/api/client";

import { Tile } from "../../../src/features/employee/components";

import { useEmployeeStyles } from "../../../src/features/employee/styles";

import { AttendanceCard } from "../../../src/features/employee/cards";

import { useEmployeeWorkspace } from "../../../src/features/employee/workspace";

// =====================================================
// TYPES
// =====================================================

type TaskStatus =
  | "TODO"
  | "IN_PROGRESS"
  | "ON_HOLD"
  | "COMPLETED"
  | "CANCELLED";

type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

type EmployeeTask = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  createdAt: string;
  assignedToId: string;
};

// =====================================================
// HELPERS
// =====================================================

function isOutstanding(task: EmployeeTask): boolean {
  return task.status !== "COMPLETED" && task.status !== "CANCELLED";
}

function formatDueDate(value: string | null): string {
  if (!value) return "No due date";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function statusLabel(status: TaskStatus): string {
  switch (status) {
    case "TODO":
      return "To Do";
    case "IN_PROGRESS":
      return "In Progress";
    case "ON_HOLD":
      return "On Hold";
    case "COMPLETED":
      return "Completed";
    case "CANCELLED":
      return "Cancelled";
  }
}

function getErrorMessage(error: unknown): string {
  return apiErrorMessage(error, "Unable to load assigned tasks.");
}

// =====================================================
// EMPLOYEE DASHBOARD
// =====================================================

export default function DashboardScreen() {
  const greeting = useTimeGreeting();
  const s = useEmployeeStyles();
  const router = useRouter();

  // Keep the existing employee workspace for
  // attendance, navigation, leave and payroll.
  const {
    splitLayout,
    go,
    leaveBalance,
    leaveTypes,
    leaveLoading,
    leaveError,
    employeeName,
    payslips,
    payslipsLoading,
    payslipsError,
    assignedProfiles, employeeProfile, setSelectedProfileId, profileLoading, profileError, refreshProfile,
    attendanceLoading, attendanceSaving, leaveSaving, refreshAttendance, refreshLeave, refreshPayslips,
  } = useEmployeeWorkspace();

  const [tasks, setTasks] = useState<EmployeeTask[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [taskError, setTaskError] = useToastState("", "error");

  const [reload, setReload] = useState(0);

  // ===================================================
  // LOAD ASSIGNED TASKS
  // ===================================================

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function loadTasks() {
        setLoadingTasks(true);
        setTaskError("");

        try {
          const response = await api.get<EmployeeTask[]>("/tasks/my");

          if (!active) return;

          if (!Array.isArray(response.data)) {
            throw new Error("Invalid task response received from backend.");
          }

          setTasks(response.data);
        } catch (error) {
          if (active) {
            setTaskError(getErrorMessage(error));
            setTasks([]);
          }
        } finally {
          if (active) {
            setLoadingTasks(false);
          }
        }
      }

      void loadTasks();

      return () => {
        active = false;
      };
    }, [reload]),
  );

  // ===================================================
  // TASK STATISTICS
  // ===================================================

  const outstanding = useMemo(() => {
    return tasks.filter(isOutstanding);
  }, [tasks]);

  const completedCount = useMemo(() => {
    return tasks.filter((task) => task.status === "COMPLETED").length;
  }, [tasks]);

  const nextTasks = useMemo(() => {
    return [...outstanding]
      .sort((a, b) => {
        const aDate = a.dueDate
          ? new Date(a.dueDate).getTime()
          : Number.MAX_SAFE_INTEGER;

        const bDate = b.dueDate
          ? new Date(b.dueDate).getTime()
          : Number.MAX_SAFE_INTEGER;

        return aDate - bDate;
      })
      .slice(0, 3);
  }, [outstanding]);

  const latestPayslip = payslips[0];

  const latestNetPay = latestPayslip
    ? Number(latestPayslip.netPay ?? latestPayslip.netSalary ?? 0)
    : null;

  // ===================================================
  // RENDER
  // ===================================================

  return (
    <>
      {/* GREETING */}

      {Platform.OS === 'web' ? <DashboardWebHeader
        greeting={`${greeting}, ${firstName(employeeName)}!`}
        branch={<SectionBranchSelect style={{ width: '100%' }} label="Choose work branch" value={employeeProfile?.id ?? ''}
          options={assignedProfiles.map(profile => ({ value: profile.id, label: assignedProfiles.some(other => other.companyId !== profile.companyId) ? `${profile.company.name} · ${profile.branch.name}` : profile.branch.name }))}
          disabled={profileLoading || attendanceSaving || leaveSaving || !assignedProfiles.length}
          error={profileError ?? undefined} onRetry={refreshProfile} onChange={setSelectedProfileId} />}
        onRefresh={() => { setReload(value => value + 1); refreshAttendance(); refreshLeave(); refreshPayslips(); }}
        refreshing={loadingTasks || attendanceLoading || leaveLoading || payslipsLoading}
      /> : <View style={s.greeting}>
        <Text style={[s.hello, { flexGrow: 1, flexShrink: 1, flexBasis: 160, minWidth: 0 }]}>
          {greeting}, {firstName(employeeName)}!
        </Text>
        <DashboardDateTimeCard />
      </View>}

      <View testID="employee-quick-actions" style={quickStyles.row}>
        {([
          { label: 'Attendance', icon: 'clock', page: 'attendance' },
          { label: 'Leave', icon: 'calendar', page: 'leave' },
          { label: 'My tasks', icon: 'check-square', page: 'tasks' },
          { label: 'Payslips', icon: 'file-text', page: 'payroll' },
        ] as const).map(action => <Pressable key={action.page} accessibilityRole="button" accessibilityLabel={action.label} onPress={() => go(action.page)} style={quickStyles.action}>
          <View style={quickStyles.icon}><AppIcon name={action.icon} size={20} color="#345cf2" /></View>
          <Text style={quickStyles.label}>{action.label}</Text>
        </Pressable>)}
      </View>

      <View style={[s.columns, splitLayout && s.desktopColumns]}>
        {/* LEFT COLUMN */}

        <View style={[s.column, !splitLayout && s.stackedColumn]}>
          {/* Existing attendance component.
              Its underlying data source is unchanged. */}

          <AttendanceCard />

          <Tile
            title="Apply for leave"
            description={
              leaveLoading
                ? "Loading leave balances…"
                : leaveError
                  ? "Open leave to retry loading balances"
                  : leaveTypes.length
                    ? leaveTypes
                        .slice(0, 2)
                        .map(
                          (type) =>
                            `${type.name}: ${leaveBalance(type.name) ?? "Unavailable"} days`,
                        )
                        .join(" · ")
                    : "No leave types configured"
            }
            symbol="♧"
            onPress={() => go("leave")}
          />

          <Tile
            description="Details & documents"
            title="My profile"
            symbol="♙"
            onPress={() => go("profile")}
          />
        </View>

        {/* RIGHT COLUMN */}

        <View style={[s.column, !splitLayout && s.stackedColumn]}>
          <SummaryMetrics centerContent={false}
            title="Your overview"
            items={[
              {
                id: "tasks",
                label: "Tasks to do",
                value: loadingTasks || taskError ? "—" : outstanding.length,
                caption: "Assigned only to you",
                icon: "check-square",
                tone: "neutral",
                onPress: () => go("tasks"),
              },
              {
                id: "payroll",
                label: "Latest take-home",
                value:
                  latestNetPay === null || !Number.isFinite(latestNetPay)
                    ? "—"
                    : formatMoney(latestNetPay, latestPayslip.currency),
                caption: payslipsLoading
                  ? "Loading payslip…"
                  : payslipsError
                    ? "Payslip unavailable. Open My Payroll to retry."
                    : latestPayslip
                      ? `${latestPayslip.run.period.month}/${latestPayslip.run.period.year} · ${latestPayslip.paid ? 'Paid' : 'Approved'}`
                      : "No published payslip",
                icon: "credit-card",
                tone: "purple",
                onPress: () => go("payroll"),
              },
            ]}
          />

          {/* NEXT TASKS */}

          <View style={s.section}>
            <Text style={s.sectionTitle}>Your next tasks</Text>

            <Pressable accessibilityRole="button" onPress={() => go("tasks")}>
              <Text style={s.link}>
                View all <AppIcon symbol="›" size={16} />
              </Text>
            </Pressable>
          </View>

          {/* TASK LOADING */}

          {loadingTasks ? (
            <View style={s.card}>
              <ActivityIndicator color="#345cf2" />

              <Text
                style={[
                  s.small,
                  {
                    marginTop: 10,
                  },
                ]}
              >
                Loading assigned tasks...
              </Text>
            </View>
          ) : taskError ? (
            <View style={s.card}>
              <Text style={s.cardTitle}>Tasks unavailable</Text>

              <Text style={s.small}>{taskError}</Text>

              <Pressable
                accessibilityRole="button"
                onPress={() => setReload((value) => value + 1)}
                style={{
                  marginTop: 12,
                  paddingVertical: 10,
                }}
              >
                <Text style={s.link}>Retry</Text>
              </Pressable>
            </View>
          ) : nextTasks.length > 0 ? (
            nextTasks.map((task) => (
              <Pressable
                key={task.id}
                accessibilityRole="button"
                accessibilityLabel={`Open task ${task.title}`}
                onPress={() =>
                  router.push({
                    pathname: "/employee/tasks/[id]",
                    params: {
                      id: task.id,
                    },
                  })
                }
                style={[
                  s.card,
                  {
                    marginBottom: 12,
                  },
                ]}
              >
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 8,
                  }}
                >
                  <Text
                    style={[
                      s.cardTitle,
                      {
                        flex: 1,
                      },
                    ]}
                  >
                    {task.title}
                  </Text>

                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: "700",
                      color: task.priority === "URGENT" ? "#c34157" : "#345cf2",
                    }}
                  >
                    {task.priority}
                  </Text>
                </View>

                {!!task.description && (
                  <Text style={[s.small, { marginTop: 8 }]} numberOfLines={2}>
                    {task.description}
                  </Text>
                )}

                <Text style={[s.small, { marginTop: 10 }]}>
                  Due: {formatDueDate(task.dueDate)}
                </Text>

                <Text style={[s.small, { marginTop: 4 }]}>
                  Status: {statusLabel(task.status)}
                </Text>
              </Pressable>
            ))
          ) : (
            <View style={s.card}>
              <Text style={s.cardTitle}>Your tasks are up to date</Text>

              <Text style={s.small}>
                No outstanding tasks are assigned to you.
              </Text>

              {completedCount > 0 && (
                <Text style={[s.small, { marginTop: 8 }]}>
                  Completed tasks: {completedCount}
                </Text>
              )}
            </View>
          )}
        </View>
      </View>
    </>
  );
}

const quickStyles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'nowrap', backgroundColor: '#fff', borderWidth: 1, borderColor: '#e4eaf5', borderRadius: 16, paddingVertical: 12, marginBottom: 20 },
  action: { flex: 1, minWidth: 0, minHeight: 68, alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 3 },
  icon: { width: 36, height: 36, borderRadius: 11, backgroundColor: '#edf1ff', alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 11, lineHeight: 16, color: '#20334f', textAlign: 'center', fontWeight: '600' },
});
