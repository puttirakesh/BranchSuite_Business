import { isInBranch } from '../../../src/core/admin/branch-filter';
import { useToastState } from '../../../src/ui/useToastState';
import { employeeDisplayId } from "../../../src/core/employee-display";
import { FloatingTextInput as TextInput } from "../../../src/ui/FloatingTextInput";
import { AppIcon } from "../../../src/ui/AppIcon";
import { AdminPageHeading } from "../../../src/ui/AdminPageHeading";
import { SummaryMetrics } from "../../../src/ui/SummaryMetrics";
import { BranchOptionsStatus } from "../../../src/ui/BranchOptionsStatus";
import {
  getAvailableBranches,
  useAvailableBranches,
} from "../../../src/core/admin/available-branches";
import { currentCompanyName, selectAdminBranch, useAdminScope } from "../../../src/core/admin/scope";
import { AdminBottomNavigation } from "../../../src/ui/AdminBottomNavigation";
import { useAdminLayout } from "../../../src/ui/useAdminLayout";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useWorkspaceFocusEffect as useFocusEffect } from '../../../src/core/admin/useWorkspaceFocusEffect';

import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { ToastModal as Modal } from '../../../src/ui/Toast';
import { SafeAreaView } from "react-native-safe-area-context";
import { getEmployees, type Employee } from "../../../src/core/employees";
import { payrollApi, type PayrollEntryDto } from "../../../src/core/admin/api";
import { getAdminScope } from "../../../src/core/admin/scope";

import {
  readPayroll,
  savePayroll,
  readRuns as readServerRuns,
  submitPayrollRun,
  approvePayrollRun,
  publishPayrollRun,
  type PayrollRecord,
  type PayrollRun,
} from "../../../src/core/payroll";

import { readTeamAttendance } from "../../../src/core/admin/attendance";
type Run = PayrollRun;
const grossWithIncentive = (record: PayrollRecord) =>
  record.gross + (record.runStatus ? 0 : record.incentives || 0);

type AttendanceCheck = {
  employeeId: string;
  date: string;
  branch?: string;
  needsReview?: boolean;
};
async function readAttendance(): Promise<AttendanceCheck[]> {
  const records = await readTeamAttendance();

  return records.map((record) => ({
    employeeId: record.employeeId,
    date: record.date,
    branch: record.branch,
    needsReview: record.needsReview,
  }));
}
const currentMonth = () => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  return `${year}-${month}`;
};
const money = (value: number) =>
  `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
async function readRuns(): Promise<Run[]> {
  return readServerRuns();
}
export default function PayrollRoute() {
  const { view } = useLocalSearchParams<{ view?: string }>();
  return view === "inputs" ? (
    <EmbeddedPayrollInputsPage />
  ) : view === "incentives" ? (
    <SalesIncentivesPage />
  ) : view === "payments" ? (
    <PaymentTrackerPage />
  ) : (
    <PayrollPage />
  );
}

function PayrollPage() {
  const { styles } = useAdminLayout(baseStyles, "page");
  const scope = useAdminScope();
  const router = useRouter();
  const params = useLocalSearchParams<{
    branch?: string;
    period?: string;
    view?: string;
  }>();
  const [branch, setBranch] = useState(
    typeof params.branch === "string" ? params.branch : "",
  );
  const [period, setPeriod] = useState(
    typeof params.period === "string" &&
      /^\d{4}-(0[1-9]|1[0-2])$/.test(params.period)
      ? params.period
      : currentMonth(),
  );
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [attendance, setAttendance] = useState<AttendanceCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useToastState("", 'error');
  const [attempt, setAttempt] = useState(0);
  const [modal, setModal] = useState<
    | "branch"
    | "period"
    | "Payroll inputs"
    | "Payroll review"
    | "Sales incentives"
    | "Payment tracker"
    | null
  >(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useToastState("", 'error');
  const [notice, setNotice] = useToastState("", 'success');
  const savingRef = useRef(false);

  useEffect(() => {
    if (!scope && typeof params.branch === "string") setBranch(params.branch);
    if (
      typeof params.period === "string" &&
      /^\d{4}-(0[1-9]|1[0-2])$/.test(params.period)
    )
      setPeriod(params.period);
  }, [params.branch, params.period]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setError("");
      Promise.all([getEmployees(), readPayroll(), readRuns(), readAttendance()])
        .then(([team, pay, savedRuns, shifts]) => {
          if (active) {
            setEmployees(team);
            setRecords(pay);
            setRuns(savedRuns);
            setAttendance(shifts);
          }
        })
        .catch((reason) => {
          if (active)
            setError(
              reason instanceof Error
                ? reason.message
                : "Could not load payroll.",
            );
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [attempt]),
  );

  const employeeFor = (record: PayrollRecord) =>
    employees.find((employee) => employee.id === record.employeeId);
  const branchFor = (record: PayrollRecord) =>
    record.branch || employeeFor(record)?.branch || "";
  const nameFor = (record: PayrollRecord) =>
    record.employeeName || employeeFor(record)?.fullName || "Unknown employee";
  const {
    branches: availableBranches,
    loading: branchesLoading,
    error: branchesError,
    refresh: refreshBranches,
  } = useAvailableBranches();
  const branches = availableBranches.map((item) => item.name);
  useEffect(() => {
    if (scope?.branchId) {
      setBranch(availableBranches.find((item) => item.id === scope.branchId)?.name ?? "");
    } else if (scope) {
      setBranch("");
    }
  }, [scope?.branchId, scope?.companyId, availableBranches, params.branch]);
  useEffect(() => {
    if (
      !branchesLoading &&
      !branchesError &&
      branch &&
      !availableBranches.some((item) => item.name === branch)
    )
      setBranch("");
  }, [availableBranches, branchesLoading, branchesError, branch]);
  const periods = [
    ...new Set([currentMonth(), ...records.map((record) => record.period)]),
  ]
    .filter((value) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value))
    .sort()
    .reverse();
  const scoped = records.filter(
    (record) =>
      record.period === period && (isInBranch({ ...record, branch: branchFor(record) }, scope?.branchId, branch)),
  );
  const team = employees.filter(
    (employee) =>
      employee.status !== "inactive" && (!branch || employee.branch === branch),
  );
  const missing = team.filter(
    (employee) => !scoped.some((record) => record.employeeId === employee.id),
  );
  const invalid = scoped.filter(
    (record) =>
      record.gross < 0 ||
      record.deductions < 0 ||
      record.deductions > record.gross ||
      (record.incentives || 0) < 0,
  );
  const attendanceChecks = attendance.filter(
    (shift) =>
      shift.needsReview &&
      shift.date.slice(0, 7) === period &&
      team.some((employee) => employee.id === shift.employeeId) &&
      (!branch ||
        (shift.branch ||
          employees.find((employee) => employee.id === shift.employeeId)
            ?.branch) === branch),
  );
  const checks = missing.length + invalid.length + attendanceChecks.length;
  const gross = scoped.reduce(
    (sum, record) => sum + grossWithIncentive(record),
    0,
  );
  const deductions = scoped.reduce((sum, record) => sum + record.deductions, 0);
  const incentives = scoped.reduce(
    (sum, record) => sum + (record.incentives || 0),
    0,
  );
  const run = runs.find(
    (item) => item.branch === branch && item.period === period,
  );
  const periodLabel = (value: string) =>
    new Date(`${value}-01T12:00:00+05:30`).toLocaleDateString("en-GB", {
      timeZone: "Asia/Kolkata",
      month: "long",
      year: "numeric",
    });
  const amount = (value: number) => (loading || error ? "—" : money(value));
  const count = (value: number) => (loading || error ? "—" : String(value));
  const submit = async () => {
    if (
      savingRef.current ||
      loading ||
      error ||
      !branch ||
      !scoped.length ||
      checks > 0 ||
      run
    ) {
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setSaveError("");
    setNotice("");

    try {
      // Recheck server data before calculating payroll.
      const [latestPayroll, latestTeam, latestRuns, latestAttendance] =
        await Promise.all([
          readPayroll(),
          getEmployees(),
          readRuns(),
          readAttendance(),
        ]);

      const latestScoped = latestPayroll.filter(
        (record) =>
          record.period === period &&
          (record.branch ||
            latestTeam.find((employee) => employee.id === record.employeeId)
              ?.branch) === branch,
      );

      const latestActiveEmployees = latestTeam.filter(
        (employee) =>
          employee.status !== "inactive" && employee.branch === branch,
      );

      if (
        latestActiveEmployees.some(
          (employee) =>
            !latestScoped.some((record) => record.employeeId === employee.id),
        )
      ) {
        throw new Error("Some employees do not have salary assignments.");
      }

      if (
        !latestScoped.length ||
        latestScoped.some(
          (record) =>
            record.gross < 0 ||
            record.deductions < 0 ||
            record.deductions > record.gross ||
            (record.incentives || 0) < 0,
        )
      ) {
        throw new Error("Resolve invalid or missing payroll amounts.");
      }

      const attendanceIssues = latestAttendance.some(
        (shift) =>
          shift.needsReview &&
          shift.date.slice(0, 7) === period &&
          latestActiveEmployees.some(
            (employee) => employee.id === shift.employeeId,
          ) &&
          (shift.branch ||
            latestTeam.find((employee) => employee.id === shift.employeeId)
              ?.branch) === branch,
      );

      if (attendanceIssues) {
        throw new Error("Resolve pending attendance checks first.");
      }

      if (
        latestRuns.some(
          (item) => item.branch === branch && item.period === period,
        )
      ) {
        setRuns(latestRuns);

        throw new Error(
          "A payroll run for this period already exists. Use a separate approver for calculated runs.",
        );
      }

      // NestJS/PostgreSQL payroll workflow:
      // 1. Create payroll period if missing
      // 2. Calculate payroll
      // 3. A separate administrator reviews and approves later.
      //
      // Calculation does NOT approve, publish or pay anyone.

      await submitPayrollRun(branch, period);

      const [updatedPayroll, updatedRuns] = await Promise.all([
        readPayroll(),
        readRuns(),
      ]);

      setRecords(updatedPayroll);
      setEmployees(latestTeam);
      setAttendance(latestAttendance);
      setRuns(updatedRuns);

      setNotice(
        "Payroll calculated. Another authorized administrator must approve it.",
      );
    } catch (cause) {
      setSaveError(
        cause instanceof Error ? cause.message : "Could not process payroll.",
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  const approveSelected = async () => {
    if (
      savingRef.current || loading || error || !branch ||
      !run?.canApprove || run.status !== "calculated"
    )
      return;
    savingRef.current = true;
    setSaving(true);
    setSaveError("");
    setNotice("");
    try {
      await approvePayrollRun(branch, period);
      const [updatedPayroll, updatedRuns] = await Promise.all([
        readPayroll(),
        readRuns(),
      ]);
      setRecords(updatedPayroll);
      setRuns(updatedRuns);
      setNotice(
        "Payroll approved by a separate administrator. Publish payslips as a separate action; payment confirmation is separate.",
      );
    } catch (cause) {
      setSaveError(
        cause instanceof Error ? cause.message : "Payroll approval failed.",
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  const publishSelected = async () => {
    if (savingRef.current || !branch || !run || run.status !== "submitted")
      return;
    savingRef.current = true;
    setSaving(true);
    setSaveError("");
    setNotice("");
    try {
      await publishPayrollRun(branch, period);
      setNotice(
        "Payslips published for employees. Payment confirmation is separate.",
      );
      setAttempt((value) => value + 1);
    } catch (cause) {
      setSaveError(
        cause instanceof Error ? cause.message : "Payslip publication failed.",
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  const workspaces = [
    {
      title: "Payroll inputs",
      description: "Resolve checks & employee amounts",
      icon: "sliders",
      badge: count(checks),
      tone: "#e8eeff",
      color: "#345cf2",
    },
    {
      title: "Payroll review",
      description: "Reconciled amounts & approval",
      icon: "check-square",
      badge: count(scoped.length),
      tone: "#def6ef",
      color: "#138f80",
    },
    {
      title: "Sales incentives",
      description: "Review saved incentive amounts",
      icon: "trending-up",
      badge: count(
        scoped.filter((record) => (record.incentives || 0) > 0).length,
      ),
      tone: "#eee7ff",
      color: "#7853c8",
    },
    {
      title: "Payment tracker",
      description: "Published payslips & payment results",
      icon: "credit-card",
      badge: "",
      tone: "#e8eeff",
      color: "#345cf2",
    },
  ] as const;
  const changeBranch = (value: string) => {
    setBranch(value);
    void selectAdminBranch(availableBranches.find((item) => item.name === value)?.id ?? null);
    setModal(null);
    setNotice("");
    setSaveError("");
  };
  if (params.view === "review")
    return (
      <PayrollReviewPage
        branch={branch}
        period={period}
        records={scoped}
        codeFor={(record) => employeeDisplayId(employeeFor(record))}
        nameFor={nameFor}
        checks={checks}
        run={run}
        loading={loading}
        error={error}
        saving={saving}
        saveError={saveError}
        notice={notice}
        submit={submit}
        retry={() => setAttempt((value) => value + 1)}
      />
    );

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.safe}>
      <View style={styles.page}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          <AdminPageHeading
            title={branch ? `${branch} payroll` : "Branch payroll"}
            titleStyle={styles.title}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Choose payroll period"
              disabled={saving}
              onPress={() => setModal("period")}
              style={[styles.period, styles.row]}
            >
              <Text numberOfLines={1} style={styles.subtitle}>
                {periodLabel(period)}
              </Text>
              <AppIcon name="chevron-down" size={16} color="#607591" />
            </Pressable>
          </AdminPageHeading>
          <View style={styles.branchCard}>
            <View style={styles.dot} />
            <View style={styles.flex}>
              <Text style={styles.name}>{branch || "All branches"}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Change branch"
              disabled={saving}
              onPress={() => setModal("branch")}
              style={styles.change}
            >
              <Text style={styles.link}>Change</Text>
            </Pressable>
          </View>
          <View style={styles.steps}>
            {["Prepare", "Review", "Approve", "Publish"].map((label, index) => (
              <View key={label} style={styles.step}>
                <View
                  style={[
                    styles.stepCircle,
                    index === (run ? 1 : 0) && styles.activeStep,
                  ]}
                >
                  <Text
                    style={[
                      styles.stepNumber,
                      index === (run ? 1 : 0) && styles.white,
                    ]}
                  >
                    {index + 1}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.stepLabel,
                    index === (run ? 1 : 0) && styles.link,
                  ]}
                >
                  {label}
                </Text>
              </View>
            ))}
          </View>
          {loading && (
            <ActivityIndicator
              accessibilityLabel="Loading payroll"
              color="#345cf2"
            />
          )}
          {error !== "" && (
            <View style={styles.errorBox}>
              <Text style={styles.error}>{error}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setAttempt((value) => value + 1)}
                style={styles.change}
              >
                <Text style={styles.link}>Retry</Text>
              </Pressable>
            </View>
          )}
          <View style={styles.splitLayout}>
            <View style={styles.splitPanel}>
              <View style={[styles.runCard, styles.fillPanel]}>
                <View style={styles.row}>
                  <Text style={[styles.runLabel, styles.flex]}>
                    {period.toUpperCase()} · {branch || "ALL BRANCHES"}
                  </Text>
                  <View style={[styles.statusBadge, run && styles.blue]}>
                    <Text style={styles.small}>
                      {run
                        ? run.status === "calculated"
                          ? "Awaiting approval"
                          : "Approved"
                        : "Draft"}
                    </Text>
                  </View>
                </View>
                <Text style={styles.net}>{amount(gross - deductions)}</Text>
                <Text style={styles.subtitle}>
                  {count(scoped.length)} employee payroll records ·{" "}
                  {periodLabel(period)}
                </Text>
              </View>
            </View>
            <View style={styles.splitPanel}>
              <SummaryMetrics
                title="Payroll overview"
                caption={`${branch || "All branches"} · ${periodLabel(period)}`}
                loading={loading}
                unavailable={!!error}
                items={[
                  {
                    id: "gross",
                    label: "Gross earnings",
                    value: amount(gross),
                    caption: "Base salary plus incentives",
                    icon: "credit-card",
                  },
                  {
                    id: "deductions",
                    label: "Deductions",
                    value: amount(deductions),
                    caption: "Saved deduction amounts",
                    icon: "minus-circle",
                    tone: "warning",
                  },
                  {
                    id: "incentives",
                    label: "Sales incentives",
                    value: amount(incentives),
                    caption: "Included once in gross",
                    icon: "trending-up",
                    tone: "purple",
                  },
                  {
                    id: "checks",
                    label: "Checks to resolve",
                    value: count(checks),
                    caption: "Missing or invalid payroll inputs",
                    icon: "alert-circle",
                    tone: checks ? "danger" : "success",
                  },
                ]}
              />
            </View>
          </View>
          <View style={styles.grid}>
            {workspaces.map((workspace) => (
              <Pressable
                key={workspace.title}
                accessibilityRole="button"
                accessibilityLabel={workspace.title}
                disabled={saving}
                onPress={
                  workspace.title === "Payroll inputs"
                    ? () =>
                        router.push({
                          pathname: "/admin/payroll",
                          params: { view: "inputs", branch, period },
                        })
                    : workspace.title === "Sales incentives"
                      ? () =>
                          router.push({
                            pathname: "/admin/payroll",
                            params: { view: "incentives", branch, period },
                          })
                      : workspace.title === "Payroll review"
                        ? () =>
                            router.push({
                              pathname: "/admin/payroll",
                              params: { view: "review", branch, period },
                            })
                        : () =>
                            router.push({
                              pathname: "/admin/payroll",
                              params: { view: "payments", branch, period },
                            })
                }
                style={styles.workspace}
              >
                <View style={styles.workspaceBody}>
                  <View style={styles.row}>
                    <View
                      style={[styles.icon, { backgroundColor: workspace.tone }]}
                    >
                      <AppIcon
                        symbol={workspace.icon}
                        style={[styles.glyph, { color: workspace.color }]}
                      />
                    </View>
                    {workspace.badge ? (
                      <View style={styles.countBadge}>
                        <Text style={styles.small}>{workspace.badge}</Text>
                      </View>
                    ) : (
                      <AppIcon symbol="›" style={styles.chevron} />
                    )}
                  </View>
                  <Text style={styles.workspaceTitle}>{workspace.title}</Text>
                  <Text style={styles.subtitle}>{workspace.description}</Text>
                </View>
                <View style={styles.workspaceFooter}>
                  <Text style={styles.link}>Open workspace</Text>
                  <AppIcon symbol="›" style={styles.link} />
                </View>
              </Pressable>
            ))}
          </View>
          {run?.status === "calculated" && run.canApprove && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Approve calculated payroll as independent approver"
              accessibilityState={{ disabled: loading || !!error || saving, busy: saving }}
              disabled={loading || !!error || saving}
              onPress={() => void approveSelected()}
              style={[styles.submit, (loading || !!error || saving) && styles.dim]}
            >
              <Text style={styles.submitText}>
                {saving
                  ? "Approving…"
                  : "Approve payroll"}
              </Text>
            </Pressable>
          )}
          {run?.status === "submitted" && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Publish approved payslips"
              disabled={saving}
              onPress={() => void publishSelected()}
              style={[styles.submit, saving && styles.dim]}
            >
              <Text style={styles.submitText}>
                {saving ? "Publishing…" : "Publish approved payslips"}
              </Text>
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Calculate payroll"
            accessibilityState={{
              disabled:
                loading ||
                !!error ||
                saving ||
                !branch ||
                !scoped.length ||
                checks > 0 ||
                !!run,
              busy: saving,
            }}
            disabled={
              loading ||
              !!error ||
              saving ||
              !branch ||
              !scoped.length ||
              checks > 0 ||
              !!run
            }
            onPress={() => void submit()}
            style={[
              styles.submit,
              (loading ||
                !!error ||
                saving ||
                !branch ||
                !scoped.length ||
                checks > 0 ||
                !!run) &&
                styles.dim,
            ]}
          >
            <Text style={styles.submitText}>
              {saving
                ? "Submitting…"
                : run
                  ? run.status === "calculated"
                    ? "Awaiting independent approval"
                    : "Payroll approved"
                  : `Calculate ${branch || "payroll"} for approval`}
            </Text>
          </Pressable>
          <Text style={styles.subtitle}>
            {!branch
              ? "Choose a branch to prepare its payroll run."
              : run?.status === "calculated"
                ? run.canApprove
                  ? "Review this branch payroll, then approve it."
                  : "Payroll submitted for approval. Another authorized administrator must review and approve this run."
                : run?.status === "submitted"
                  ? "Payroll approved. You can publish the employee payslips."
                  : !scoped.length
                    ? "Add payroll records to prepare this run."
                    : checks
                      ? "Resolve payroll checks before submitting."
                      : "Calculate payroll from saved salary assignments. A different administrator must approve."}
          </Text>
          {notice !== "" && (
            <Text accessibilityLiveRegion="polite" style={styles.notice}>
              {notice}
            </Text>
          )}
          {saveError !== "" && (
            <Text accessibilityLiveRegion="polite" style={styles.error}>
              {saveError}
            </Text>
          )}
        </ScrollView>
        <AdminBottomNavigation disabled={saving} />
      </View>
      <Modal
        transparent
        visible={modal !== null}
        animationType="fade"
        onRequestClose={() => setModal(null)}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.row}>
              <Text style={styles.modalTitle}>
                {modal === "branch"
                  ? "Choose branch"
                  : modal === "period"
                    ? "Choose period"
                    : modal}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close payroll dialog"
                onPress={() => setModal(null)}
                style={styles.close}
              >
                <AppIcon symbol="×" style={styles.chevron} />
              </Pressable>
            </View>
            <ScrollView>
              {modal === "branch" && (
                <BranchOptionsStatus
                  loading={branchesLoading}
                  error={branchesError}
                  empty={branches.length === 0}
                  onRetry={refreshBranches}
                />
              )}
              {modal === "branch" ? (
                ["", ...branches].map((value) => (
                  <Pressable
                    key={value}
                    accessibilityRole="button"
                    accessibilityLabel={value || "All branches"}
                    onPress={() => changeBranch(value)}
                    style={styles.option}
                  >
                    <Text style={styles.name}>{value || "All branches"}</Text>
                    <AppIcon
                      symbol={branch === value ? "✓" : ""}
                      style={styles.link}
                    />
                  </Pressable>
                ))
              ) : modal === "period" ? (
                periods.map((value) => (
                  <Pressable
                    key={value}
                    accessibilityRole="button"
                    accessibilityLabel={periodLabel(value)}
                    onPress={() => {
                      setPeriod(value);
                      setModal(null);
                      setNotice("");
                      setSaveError("");
                    }}
                    style={styles.option}
                  >
                    <Text style={styles.name}>{periodLabel(value)}</Text>
                    <AppIcon
                      symbol={period === value ? "✓" : ""}
                      style={styles.link}
                    />
                  </Pressable>
                ))
              ) : loading ? (
                <ActivityIndicator color="#345cf2" />
              ) : error ? (
                <Text style={styles.error}>{error}</Text>
              ) : modal === "Payment tracker" ? (
                <View style={styles.detail}>
                  <Text style={styles.name}>No payment results connected</Text>
                  <Text style={styles.subtitle}>
                    Payments and published payslips will appear here when
                    available.
                  </Text>
                </View>
              ) : modal === "Payroll inputs" ? (
                <View style={styles.detail}>
                  <Text style={styles.name}>{checks} checks to resolve</Text>
                  {missing.map((employee) => (
                    <Text key={employee.id} style={styles.subtitle}>
                      {employee.fullName} · Payroll inputs missing
                    </Text>
                  ))}
                  {invalid.map((record, index) => (
                    <Text key={index} style={styles.error}>
                      {nameFor(record)} · Check gross, deductions and incentives
                    </Text>
                  ))}
                  {checks === 0 && (
                    <Text style={styles.subtitle}>
                      {scoped.length
                        ? "Saved payroll inputs have no amount checks."
                        : "No payroll inputs saved for this selection."}
                    </Text>
                  )}
                </View>
              ) : (
                <View style={styles.detail}>
                  {(modal === "Sales incentives"
                    ? scoped.filter((record) => (record.incentives || 0) > 0)
                    : scoped
                  ).map((record, index) => (
                    <View key={index} style={styles.detailRow}>
                      <Text style={styles.name}>{nameFor(record)}</Text>
                      {modal === "Sales incentives" ? (
                        <Text style={styles.subtitle}>
                          Incentives {money(record.incentives || 0)}
                        </Text>
                      ) : (
                        <>
                          <Text style={styles.subtitle}>
                            Gross {money(grossWithIncentive(record))} ·
                            Deductions {money(record.deductions)}
                          </Text>
                          <Text style={styles.name}>
                            Net{" "}
                            {money(
                              grossWithIncentive(record) - record.deductions,
                            )}
                          </Text>
                        </>
                      )}
                    </View>
                  ))}
                  {(modal === "Sales incentives"
                    ? !scoped.some((record) => (record.incentives || 0) > 0)
                    : !scoped.length) && (
                    <Text style={styles.subtitle}>
                      No records for this selection.
                    </Text>
                  )}
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setModal(null);
                      router.push({
                        pathname: "/admin/reports",
                        params: { branch },
                      });
                    }}
                    style={styles.change}
                  >
                    <Text style={styles.link}>Open Branch reports</Text>
                  </Pressable>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

type ReviewProps = {
  branch: string;
  period: string;
  records: PayrollRecord[];
  nameFor: (record: PayrollRecord) => string;
  codeFor: (record: PayrollRecord) => string;
  checks: number;
  run?: Run;
  loading: boolean;
  error: string;
  saving: boolean;
  saveError: string;
  notice: string;
  submit: () => Promise<void>;
  retry: () => void;
};
const htmlEscape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ]!,
  );
function PayrollReviewPage({
  branch,
  period,
  records,
  nameFor,
  codeFor,
  checks,
  run,
  loading,
  error,
  saving,
  saveError,
  notice,
  submit,
  retry,
}: ReviewProps) {
  const { styles } = useAdminLayout(reviewStyles, "detail");
  const router = useRouter();
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);
  const exportRef = useRef(false);
  const [exportError, setExportError] = useToastState("", 'error');
  const [exportNotice, setExportNotice] = useToastState("", 'info');
  const gross = records.reduce(
    (sum, record) => sum + grossWithIncentive(record),
    0,
  );
  const deductions = records.reduce(
    (sum, record) => sum + record.deductions,
    0,
  );
  const incentives = records.reduce(
    (sum, record) => sum + (record.incentives || 0),
    0,
  );
  const periodText = new Date(`${period}-01T12:00:00+05:30`).toLocaleDateString(
    "en-GB",
    { timeZone: "Asia/Kolkata", month: "long", year: "numeric" },
  );
  const [year, month] = period.split("-").map(Number);
  const scheduledDate = new Date(year, month, 0).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const component = (
    field: "basicSalary" | "houseRentAllowance" | "specialAllowance",
  ) =>
    records.length &&
    records.every(
      (record) =>
        typeof record[field] === "number" && Number.isFinite(record[field]),
    )
      ? money(records.reduce((sum, record) => sum + record[field]!, 0))
      : "—";
  const summary: [string, string][] = [
    ["Employees shown in this review", String(records.length)],
    ["Basic salary", component("basicSalary")],
    ["House rent allowance", component("houseRentAllowance")],
    ["Special allowance", component("specialAllowance")],
    ["Recorded incentives (included in gross)", money(incentives)],
    ["Gross earnings", money(gross)],
    ["Total deductions", money(deductions)],
    ["Net payable", money(gross - deductions)],
  ];
  const metadata: [string, string][] = [
    ["PREPARED BY", run ? "See backend payroll run" : "Not calculated"],
    [
      "APPROVED BY",
      run?.status === "submitted"
        ? "Approved (see backend audit)"
        : "Awaiting approval",
    ],
    ["REVISION", "See backend run history"],
    [
      "STATUS",
      run
        ? run.status === "calculated"
          ? "Awaiting approval"
          : "Approved"
        : "Draft",
    ],
    ["SCHEDULED DATE", scheduledDate],
    ["BRANCH", branch || "All branches"],
    ["COMPANY", currentCompanyName()],
  ];
  const exportReview = async (format: "csv" | "pdf") => {
    if (exportRef.current || loading || error || !records.length) return;
    exportRef.current = true;
    setExporting(format);
    setExportError("");
    setExportNotice("");
    const filename = `payroll-review-${period}-${(branch || "all-branches").replace(/[^a-zA-Z0-9_-]/g, "-")}`;
    try {
      const csvCell = (value: string | number) => {
        const text = String(value);
        return `"${(/^[=+@-]/.test(text) ? `'${text}` : text).replaceAll('"', '""')}"`;
      };
      const csv =
        "\uFEFF" +
        [
          ["Payroll review", branch || "All branches", period],
          [
            "Employee",
            "Employee ID",
            "Gross earnings",
            "Deductions",
            "Recorded incentives (included in gross)",
            "Net payable",
          ],
          ...records.map((record) => [
            nameFor(record),
            codeFor(record),
            grossWithIncentive(record),
            record.deductions,
            record.incentives || 0,
            grossWithIncentive(record) - record.deductions,
          ]),
          [],
          ["Summary", "Amount"],
          ...summary,
        ]
          .map((row) => row.map(csvCell).join(","))
          .join("\r\n");
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>${htmlEscape(filename)}</title><style>@page{size:A4;margin:20mm}body{font:14px Arial;color:#20334f}h1{font-size:24px}table{width:100%;border-collapse:collapse;margin:20px 0}td{padding:12px 8px;border-bottom:1px solid #e4eaf5}td:last-child{text-align:right;font-weight:bold}.total{background:#eef7f4;color:#138f80}button{padding:12px 20px;background:#345cf2;color:white;border:0;border-radius:8px;cursor:pointer}@media print{button{display:none}}</style></head><body><h1>Payroll review</h1><p>${htmlEscape(currentCompanyName())} · ${htmlEscape(branch || "All branches")} · ${htmlEscape(periodText)} · payroll summary</p><table>${summary.map(([label, value]) => `<tr class="${label === "Gross earnings" || label === "Net payable" ? "total" : ""}"><td>${htmlEscape(label)}</td><td>${htmlEscape(value)}</td></tr>`).join("")}</table><p>Reconciled: gross earnings − deductions = net payable. Recorded incentives are included in gross and shown separately for reference.</p><table>${metadata.map(([label, value]) => `<tr><td>${label}</td><td>${htmlEscape(value)}</td></tr>`).join("")}</table><p>Figures from the BranchSuite payroll module.</p></body></html>`;
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
          setExportNotice("CSV download started.");
        } else {
          const printWindow = window.open("", "_blank");
          if (!printWindow)
            throw new Error(
              "Allow pop-ups for this site, then export the PDF again.",
            );
          printWindow.document.write(html);
          printWindow.document.close();
          const printButton = printWindow.document.createElement("button");
          printButton.textContent = "Save as PDF";
          printButton.addEventListener("click", () => printWindow.print());
          printWindow.document.body.prepend(printButton);
          printWindow.focus();
          printWindow.print();
          setExportNotice("Choose Save as PDF in the print dialog.");
        }
      } else if (Platform.OS === "android") {
        const FileSystem = await import("expo-file-system/legacy");
        let contents = csv;
        if (format === "pdf") {
          const Print = await import("expo-print");
          const file = await Print.printToFileAsync({ html, base64: true });
          if (!file.base64) throw new Error("The PDF could not be generated.");
          contents = file.base64;
        }
        const permission =
          await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (!permission.granted) {
          setExportNotice("Export cancelled.");
          return;
        }
        const outputName = `${filename}-${Date.now()}.${format}`;
        const uri = await FileSystem.StorageAccessFramework.createFileAsync(
          permission.directoryUri,
          outputName,
          format === "pdf" ? "application/pdf" : "text/csv",
        );
        await FileSystem.writeAsStringAsync(uri, contents, {
          encoding:
            format === "pdf"
              ? FileSystem.EncodingType.Base64
              : FileSystem.EncodingType.UTF8,
        });
        setExportNotice(`Saved ${outputName}`);
      } else {
        const Sharing = await import("expo-sharing");
        if (!(await Sharing.isAvailableAsync()))
          throw new Error("File sharing is unavailable on this device.");
        let uri: string;
        if (format === "pdf") {
          const Print = await import("expo-print");
          uri = (await Print.printToFileAsync({ html })).uri;
        } else {
          const { File, Paths } = await import("expo-file-system");
          const file = new File(Paths.cache, `${filename}.csv`);
          file.create({ overwrite: true });
          file.write(csv);
          uri = file.uri;
        }
        await Sharing.shareAsync(uri, {
          mimeType: format === "pdf" ? "application/pdf" : "text/csv",
          UTI:
            format === "pdf"
              ? "com.adobe.pdf"
              : "public.comma-separated-values-text",
          dialogTitle: "Save payroll review",
        });
        setExportNotice("Choose where to save the export in the share sheet.");
      }
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "Could not export payroll review.";
      setExportError(message);

    } finally {
      exportRef.current = false;
      setExporting(null);
    }
  };
  const blocked =
    loading ||
    !!error ||
    saving ||
    !branch ||
    !records.length ||
    checks > 0 ||
    !!run;
  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.safe}>
      <View style={styles.page}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <AdminPageHeading
            title="Payroll review"
            onBack={() =>
              router.replace({
                pathname: "/admin/payroll",
                params: { branch, period },
              })
            }
            backDisabled={saving || !!exporting}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Export payroll CSV"
              disabled={loading || !!error || !!exporting || !records.length}
              onPress={() => void exportReview("csv")}
              style={styles.csvButton}
            >
              <Text style={styles.name}>
                {exporting === "csv" ? "Saving..." : "CSV"}
              </Text>
            </Pressable>
          </AdminPageHeading>
          <View style={styles.steps}>
            {["Prepare", "Review", "Approve", "Publish"].map((label, index) => (
              <View key={label} style={styles.step}>
                <View
                  style={[
                    styles.stepCircle,
                    index === (run ? 2 : 0) && styles.activeStep,
                  ]}
                >
                  <Text
                    style={[
                      styles.stepNumber,
                      index === (run ? 2 : 0) && styles.white,
                    ]}
                  >
                    {index + 1}
                  </Text>
                </View>
                <Text style={styles.stepLabel}>{label}</Text>
              </View>
            ))}
          </View>
          {loading ? (
            <ActivityIndicator
              accessibilityLabel="Loading payroll review"
              color="#345cf2"
            />
          ) : error ? (
            <View style={styles.reviewCard}>
              <Text style={styles.error}>{error}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={retry}
                style={styles.change}
              >
                <Text style={styles.link}>Retry</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.reviewCard}>
                <Text style={styles.reviewTitle}>{periodText} summary</Text>
                {summary.map(([label, value]) => (
                  <View
                    key={label}
                    style={[
                      styles.reviewRow,
                      (label === "Gross earnings" || label === "Net payable") &&
                        styles.reviewTotal,
                    ]}
                  >
                    <Text
                      style={
                        label === "Gross earnings" || label === "Net payable"
                          ? styles.reviewTotalText
                          : styles.reviewLabel
                      }
                    >
                      {label}
                    </Text>
                    <Text
                      style={
                        label === "Gross earnings" || label === "Net payable"
                          ? styles.reviewTotalText
                          : styles.reviewValue
                      }
                    >
                      {value}
                    </Text>
                  </View>
                ))}
                {records.length > 0 &&
                  summary.slice(1, 4).some(([, value]) => value === "—") && (
                    <Text style={styles.small}>
                      Salary components have not been provided for all records.
                    </Text>
                  )}
              </View>
              <View style={styles.reconciled}>
                <Text style={styles.reconciledText}>
                  ⓘ Reconciled: gross earnings − deductions = net payable.
                  Recorded incentives are included in gross and shown separately
                  for reference.
                </Text>
              </View>
              <View style={styles.reviewCard}>
                <View style={styles.reviewDetails}>
                  {metadata.map(([label, value]) => (
                    <View
                      key={label}
                      style={[
                        styles.reviewDetail,
                        label === "COMPANY" && styles.fullDetail,
                      ]}
                    >
                      <Text style={styles.reviewDetailLabel}>{label}</Text>
                      <Text style={styles.reviewDetailValue}>{value}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Submit payroll review for approval"
                accessibilityState={{ disabled: blocked, busy: saving }}
                disabled={blocked}
                onPress={() => void submit()}
                style={[
                  styles.submit,
                  styles.reviewSubmit,
                  blocked && styles.dim,
                ]}
              >
                <Text style={styles.submitText}>
                  {saving
                    ? "Submitting…"
                    : run
                      ? run.status === "calculated"
                        ? "Awaiting independent approval"
                        : "Payroll approved"
                      : `Calculate ${branch || "payroll"} for approval`}
                </Text>
              </Pressable>
              <Text style={styles.small}>
                {!branch
                  ? "Choose a branch on Payroll first."
                  : !records.length
                    ? "Add payroll inputs for this period first."
                    : checks
                      ? `Resolve ${checks} open ${checks === 1 ? "check" : "checks"} in this branch first.`
                      : run
                        ? run.status === "calculated"
                          ? "Awaiting approval by a different administrator."
                          : "Payroll approved for this branch and month."
                        : "Ready to submit this branch for approval."}
              </Text>
              {checks > 0 && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({
                      pathname: "/admin/payroll",
                      params: { view: "inputs", branch, period },
                    })
                  }
                  style={styles.change}
                >
                  <Text style={styles.link}>Resolve payroll checks</Text>
                </Pressable>
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Export review PDF"
                disabled={!!exporting || !records.length}
                onPress={() => void exportReview("pdf")}
                style={[
                  styles.pdfButton,
                  (!!exporting || !records.length) && styles.dim,
                ]}
              >
                <Text style={styles.name}>
                  {exporting === "pdf" ? "Preparing PDF…" : "Export review PDF"}
                </Text>
              </Pressable>
            </>
          )}
          {(notice || exportNotice) !== "" && (
            <Text accessibilityLiveRegion="polite" style={styles.notice}>
              {notice || exportNotice}
            </Text>
          )}
          {(saveError || exportError) !== "" && (
            <Text accessibilityLiveRegion="polite" style={styles.error}>
              {saveError || exportError}
            </Text>
          )}
        </ScrollView>
        <AdminBottomNavigation disabled={saving || !!exporting} />
      </View>
    </SafeAreaView>
  );
}

function PaymentTrackerPage() {
  const workspaceScope = useAdminScope();
  const { styles } = useAdminLayout(paymentStyles);
  const router = useRouter();

  const params = useLocalSearchParams<{
    branch?: string;
    period?: string;
  }>();

  const period =
    params.period && /^\d{4}-(0[1-9]|1[0-2])$/.test(params.period)
      ? params.period
      : currentMonth();

  const [branch, setBranch] = useState(params.branch || "");
  const {
    branches,
    loading: branchesLoading,
    error: branchesError,
    refresh: refreshBranches,
  } = useAvailableBranches();
  useEffect(() => {
    if (
      !branchesLoading &&
      !branchesError &&
      branch &&
      !branches.some((item) => item.name === branch)
    )
      setBranch("");
  }, [branches, branchesLoading, branchesError, branch]);

  const [entries, setEntries] = useState<
    Array<
      PayrollEntryDto & {
        branchName: string;
        runStatus: string;
      }
    >
  >([]);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useToastState("", 'error');
  const [attempt, setAttempt] = useState(0);
  const [picker, setPicker] = useState(false);

  const [payingId, setPayingId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<
    "BANK_TRANSFER" | "CASH" | "UPI" | "OTHER"
  >("BANK_TRANSFER");
  const [paymentReference, setPaymentReference] = useState("");
  const [selectedEntry, setSelectedEntry] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useToastState("", 'error');
  const [notice, setNotice] = useToastState("", 'success');

  const paymentBusy = useRef(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function loadPayments() {
        setLoading(true);
        setError("");

        try {
          const scope = await getAdminScope();
          const permitted = await getAvailableBranches(scope.companyId);

          const [team, allPeriods] = await Promise.all([
            getEmployees(),
            Promise.all(
              permitted.map(async (item) => ({
                branch: item,
                periods: await payrollApi.periods(scope.companyId, item.id),
              })),
            ),
          ]);

          const [year, month] = period.split("-").map(Number);

          const matchedRuns = allPeriods.flatMap((item) =>
            item.periods
              .filter(
                (p) =>
                  p.year === year &&
                  p.month === month &&
                  p.run &&
                  ["APPROVED", "PAID"].includes(p.run.status),
              )
              .map((p) => ({
                branchName: item.branch.name,
                runId: p.run!.id,
              })),
          );

          const runs = await Promise.all(
            matchedRuns.map(async (item) => ({
              ...item,
              run: await payrollApi.run(item.runId),
            })),
          );

          if (!active) return;

          setEmployees(team);

          setEntries(
            runs.flatMap((item) =>
              item.run.entries.map((entry) => ({
                ...entry,
                branchName: item.branchName,
                runStatus: item.run.status,
              })),
            ),
          );
        } catch (cause) {
          if (active) {
            setError(
              cause instanceof Error
                ? cause.message
                : "Could not load payroll payments.",
            );
          }
        } finally {
          if (active) setLoading(false);
        }
      }

      void loadPayments();

      return () => {
        active = false;
      };
    }, [attempt, period]),
  );

  useEffect(() => {
    if (workspaceScope) setBranch(workspaceScope.branches.find(item => item.id === workspaceScope.branchId)?.name ?? "");
  }, [workspaceScope, params.branch]);

  const visible = entries.filter(
    (entry) => !branch || entry.branchName === branch,
  );

  const employeeName = (entry: PayrollEntryDto) =>
    entry.user?.name ||
    employees.find((item) => item.id === entry.userId)?.fullName ||
    entry.userId;

  const paidEntries = visible.filter((entry) => !!entry.payment);
  const unpaidEntries = visible.filter((entry) => !entry.payment);

  const netTotal = visible.reduce(
    (sum, entry) => sum + Number(entry.netAmount || 0),
    0,
  );

  const paidTotal = paidEntries.reduce(
    (sum, entry) => sum + Number(entry.netAmount || 0),
    0,
  );

  const pendingTotal = unpaidEntries.reduce(
    (sum, entry) => sum + Number(entry.netAmount || 0),
    0,
  );

  const periodText = new Date(`${period}-01T12:00:00+05:30`).toLocaleDateString(
    "en-GB",
    {
      timeZone: "Asia/Kolkata",
      month: "long",
      year: "numeric",
    },
  );

  const openPayroll = () =>
    router.replace({
      pathname: "/admin/payroll",
      params: { branch, period },
    });

  const chooseBranch = (value: string) => {
    setBranch(value);
    void selectAdminBranch(branches.find((item) => item.name === value)?.id ?? null);
    router.setParams({ branch: value });
    setPicker(false);
  };

  const recordPayment = async () => {
    if (!selectedEntry || paymentBusy.current) return;

    const entry = visible.find((item) => item.id === selectedEntry);

    if (!entry || entry.payment) {
      setPaymentError("This payroll entry is already paid or unavailable.");
      return;
    }

    paymentBusy.current = true;
    setPayingId(entry.id);
    setPaymentError("");
    setNotice("");

    try {
      await payrollApi.pay(
        entry.id,
        paymentMethod,
        paymentReference.trim() || undefined,
      );

      setSelectedEntry(null);
      setPaymentReference("");
      setNotice(
        `Payment record saved for ${employeeName(entry)}. Verify settlement separately.`,
      );

      // Read authoritative paid status from PostgreSQL.
      setAttempt((value) => value + 1);
    } catch (cause) {
      setPaymentError(
        cause instanceof Error ? cause.message : "Could not record payment.",
      );
    } finally {
      paymentBusy.current = false;
      setPayingId(null);
    }
  };

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.safe}>
      <View style={styles.page}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <AdminPageHeading title="Payment tracker" onBack={openPayroll} />
          <View
            accessibilityLabel="Page filters"
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 12,
              marginVertical: 12,
            }}
          >
            <Pressable
              onPress={() => setPicker(true)}
              style={[styles.headerFilter, styles.blue]}
            >
              <Text style={styles.headerText}>{branch || "All branches"}</Text>
            </Pressable>
          </View>

          {notice !== "" && <Text style={styles.notice}>{notice}</Text>}

          {paymentError !== "" && (
            <Text style={styles.error}>{paymentError}</Text>
          )}

          {loading ? (
            <ActivityIndicator color="#345cf2" />
          ) : error ? (
            <View style={styles.incentiveCard}>
              <Text style={styles.error}>{error}</Text>
              <Pressable
                onPress={() => setAttempt((v) => v + 1)}
                style={styles.change}
              >
                <Text style={styles.link}>Retry</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <SummaryMetrics
                title="Payment overview"
                caption={`${paidEntries.length} paid · ${unpaidEntries.length} unpaid`}
                items={[
                  {
                    id: "total",
                    label: "Total payroll",
                    value: money(netTotal),
                    icon: "credit-card",
                  },
                  {
                    id: "paid",
                    label: "Paid",
                    value: money(paidTotal),
                    icon: "check-circle",
                    tone: "success",
                  },
                  {
                    id: "pending",
                    label: "Pending payment",
                    value: money(pendingTotal),
                    icon: "clock",
                    tone: "warning",
                  },
                ]}
              />

              {visible.length === 0 ? (
                <View style={styles.paymentEmpty}>
                  <Text style={styles.paymentEmptyTitle}>
                    No approved payroll entries
                  </Text>

                  <Text style={styles.paymentEmptyText}>
                    Calculate and approve the selected branch payroll before
                    recording payments.
                  </Text>

                  <Pressable onPress={openPayroll} style={styles.openPayroll}>
                    <Text style={styles.submitText}>Open branch payroll</Text>
                  </Pressable>
                </View>
              ) : (
                visible.map((entry) => (
                  <View key={entry.id} style={styles.incentiveCard}>
                    <View style={styles.row}>
                      <View style={styles.flex}>
                        <Text style={styles.name}>{employeeName(entry)}</Text>
                        <Text style={styles.subtitle}>{entry.branchName}</Text>
                      </View>

                      <View
                        style={[
                          styles.incentiveBadge,
                          !entry.payment && styles.pendingBadge,
                        ]}
                      >
                        <Text style={styles.incentiveBadgeText}>
                          {entry.payment ? "Paid" : "Unpaid"}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.subtitle}>
                      Gross: {money(Number(entry.grossAmount))}
                    </Text>

                    <Text style={styles.subtitle}>
                      Deductions: {money(Number(entry.deductionsAmount))}
                    </Text>

                    <Text style={[styles.name, { marginTop: 10 }]}>
                      Net payable: {money(Number(entry.netAmount))}
                    </Text>

                    {entry.payment ? (
                      <Text style={styles.notice}>
                        Paid on{" "}
                        {new Date(entry.payment.paidAt).toLocaleDateString(
                          "en-GB",
                        )}
                      </Text>
                    ) : (
                      <Pressable
                        accessibilityRole="button"
                        disabled={payingId !== null}
                        onPress={() => {
                          setSelectedEntry(entry.id);
                          setPaymentError("");
                        }}
                        style={[
                          styles.openPayroll,
                          payingId !== null && styles.dim,
                        ]}
                      >
                        <Text style={styles.submitText}>Record payment</Text>
                      </Pressable>
                    )}
                  </View>
                ))
              )}
            </>
          )}
        </ScrollView>

        <AdminBottomNavigation />
      </View>

      <Modal
        transparent
        visible={picker}
        animationType="fade"
        onRequestClose={() => setPicker(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Choose branch</Text>

            <ScrollView>
              <BranchOptionsStatus
                loading={branchesLoading}
                error={branchesError}
                empty={branches.length === 0}
                onRetry={refreshBranches}
              />
              {[{ id: "", name: "All branches" }, ...branches].map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => chooseBranch(item.id ? item.name : "")}
                  style={styles.option}
                >
                  <Text style={styles.name}>{item.name}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <Pressable onPress={() => setPicker(false)} style={styles.change}>
              <Text style={styles.link}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        transparent
        visible={selectedEntry !== null}
        animationType="fade"
        onRequestClose={() => {
          if (!paymentBusy.current) setSelectedEntry(null);
        }}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Confirm salary payment</Text>

            <Text style={styles.subtitle}>
              Only record a payment after funds have actually been transferred
              or paid.
            </Text>

            <Text style={[styles.name, { marginTop: 18 }]}>Payment method</Text>

            {(["BANK_TRANSFER", "UPI", "CASH", "OTHER"] as const).map(
              (method) => (
                <Pressable
                  key={method}
                  onPress={() => setPaymentMethod(method)}
                  style={styles.option}
                  disabled={payingId !== null}
                >
                  <Text style={styles.name}>{method.replace("_", " ")}</Text>

                  <AppIcon
                    symbol={paymentMethod === method ? "✓" : ""}
                    style={styles.link}
                  />
                </Pressable>
              ),
            )}

            <TextInput
              validation={{ required: true, maxLength: 150 }}
              value={paymentReference}
              onChangeText={setPaymentReference}
              label="Bank/UPI/receipt reference (provide verified evidence)"
              editable={payingId === null}
              style={{
                borderWidth: 1,
                borderColor: "#dce5f3",
                borderRadius: 12,
                padding: 12,
                marginTop: 12,
                color: "#20334f",
              }}
            />

            <Pressable
              accessibilityRole="button"
              disabled={payingId !== null}
              onPress={() => void recordPayment()}
              style={[styles.openPayroll, payingId !== null && styles.dim]}
            >
              <Text style={styles.submitText}>
                {payingId ? "Recording…" : "Confirm payment recorded"}
              </Text>
            </Pressable>

            <Pressable
              disabled={payingId !== null}
              onPress={() => setSelectedEntry(null)}
              style={styles.change}
            >
              <Text style={styles.link}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
function SalesIncentivesPage() {
  const { styles } = useAdminLayout(incentiveStyles, "page");
  const router = useRouter();
  const scope = useAdminScope();
  const branch = scope?.branches.find(item => item.id === scope.branchId)?.name ?? "";
  const { period = currentMonth() } = useLocalSearchParams<{
    branch?: string;
    period?: string;
  }>();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payroll, setPayroll] = useState<PayrollRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useToastState("", 'error');
  const [attempt, setAttempt] = useState(0);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setError("");
      Promise.all([getEmployees(), readPayroll()])
        .then(([team, records]) => {
          if (active) {
            setEmployees(team);
            setPayroll(records);
          }
        })
        .catch((cause) => {
          if (active)
            setError(
              cause instanceof Error
                ? cause.message
                : "Could not load sales incentives.",
            );
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [attempt]),
  );
  const approved = payroll
    .filter(
      (record) =>
        record.period === period &&
        (!branch ||
          (record.branch ||
            employees.find((employee) => employee.id === record.employeeId)
              ?.branch) === branch) &&
        (record.incentives || 0) > 0,
    )
    .map((record) => ({
      id: `payroll-${record.employeeId}-${record.period}`,
      owner:
        record.employeeName ||
        employees.find((employee) => employee.id === record.employeeId)
          ?.fullName ||
        "Unknown employee",
      reference: `${employeeDisplayId(employees.find((employee) => employee.id === record.employeeId))} · ${record.period}`,
      value: record.incentives!,
      status: "Recorded",
    }));
  const incentives = approved;
  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.safe}>
      <View style={styles.page}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <AdminPageHeading
            title="Sales incentives"
            onBack={() =>
              router.replace({
                pathname: "/admin/payroll",
                params: { branch, period },
              })
            }
          />
          <View style={styles.incentiveInfo}>
            <AppIcon symbol="ⓘ" style={styles.link} />
            <Text style={[styles.incentiveInfoText, styles.flex]}>
              Payroll incentives saved in payroll inputs are included in the
              next calculated run. CRM deals do not generate incentives
              automatically.
            </Text>
          </View>
          {loading ? (
            <ActivityIndicator
              accessibilityLabel="Loading sales incentives"
              color="#345cf2"
            />
          ) : error ? (
            <View style={styles.incentiveCard}>
              <Text style={styles.error}>{error}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setAttempt((value) => value + 1)}
                style={styles.change}
              >
                <Text style={styles.link}>Retry</Text>
              </Pressable>
            </View>
          ) : incentives.length === 0 ? (
            <View style={styles.incentiveCard}>
              <Text style={styles.name}>No sales incentives yet</Text>
              <Text style={styles.subtitle}>
                Recorded payroll incentives will appear here.
              </Text>
            </View>
          ) : (
            incentives.map((incentive) => (
              <View key={incentive.id} style={styles.incentiveCard}>
                <View style={styles.row}>
                  <View style={styles.flex}>
                    <Text style={styles.name}>{incentive.owner}</Text>
                    <Text style={styles.subtitle}>{incentive.reference}</Text>
                  </View>
                  <View
                    style={[
                      styles.incentiveBadge,
                      incentive.status === "Pending" && styles.pendingBadge,
                    ]}
                  >
                    <Text style={styles.incentiveBadgeText}>
                      {incentive.status}
                    </Text>
                  </View>
                </View>
                <View style={styles.incentiveAmountRow}>
                  <Text style={styles.incentiveLabel}>Incentive</Text>
                  <Text style={styles.name}>{money(incentive.value)}</Text>
                </View>
              </View>
            ))
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View sales pipeline"
            onPress={() =>
              router.push({
                pathname: "/admin/crm/[module]",
                params: { module: "deals", ...(branch ? { branch } : {}) },
              })
            }
            style={styles.pipelineButton}
          >
            <Text style={styles.link}>View sales pipeline</Text>
          </Pressable>
        </ScrollView>
        <AdminBottomNavigation />
      </View>
    </SafeAreaView>
  );
}

const baseStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f6f8fd" },
  page: { flex: 1, width: "100%", maxWidth: 960, alignSelf: "center" },
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
  period: { minHeight: 32, justifyContent: "center" },
  branchCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e4eaf5",
    borderRadius: 17,
    backgroundColor: "#fff",
    marginTop: 14,
  },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#39b8a7" },
  name: { fontSize: 12, fontWeight: "700", color: "#20334f" },
  change: { minHeight: 44, paddingHorizontal: 8, justifyContent: "center" },
  link: { fontSize: 10, fontWeight: "600", color: "#345cf2" },
  steps: { flexDirection: "row", marginVertical: 16 },
  step: { flex: 1, alignItems: "center", gap: 6 },
  stepCircle: {
    width: 25,
    height: 25,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e7edf7",
  },
  activeStep: { backgroundColor: "#345cf2" },
  stepNumber: { fontSize: 10, color: "#7a8ba5", fontWeight: "600" },
  white: { color: "#fff" },
  stepLabel: { fontSize: 9, color: "#607591" },
  runCard: {
    padding: 20,
    borderRadius: 20,
    backgroundColor: "#eeedfc",
    borderWidth: 1,
    borderColor: "#e2e6fc",
    marginBottom: 16,
  },
  runLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1,
    color: "#345cf2",
  },
  statusBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#fff1d9",
  },
  net: { fontSize: 32, fontWeight: "800", color: "#20334f", marginTop: 16 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 16 },
  metric: {
    width: "46%",
    flexGrow: 1,
    padding: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e0e8f5",
    borderRadius: 16,
    alignItems: "flex-start",
    justifyContent: "center",
    paddingVertical: 16,
    minWidth: 0,
  },
  metricLabel: {
    fontSize: 10,
    color: "#607591",
    textAlign: "left",
    flexShrink: 1,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: "800",
    color: "#20334f",
    marginVertical: 7,
    textAlign: "left",
    flexShrink: 1,
  },
  workspace: {
    width: "46%",
    flexGrow: 1,
    borderWidth: 1,
    borderColor: "#e0e8f5",
    borderRadius: 18,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  workspaceBody: { padding: 14, minHeight: 144 },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  glyph: { fontSize: 23 },
  countBadge: {
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: "#f2f5fc",
  },
  workspaceTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#20334f",
    marginTop: 14,
  },
  workspaceFooter: {
    minHeight: 36,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#f0f3f9",
    backgroundColor: "#fcfdff",
  },
  submit: {
    minHeight: 46,
    borderRadius: 13,
    backgroundColor: "#345cf2",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  submitText: { fontSize: 12, fontWeight: "700", color: "#fff" },
  dim: { opacity: 0.5 },
  notice: { marginTop: 12, fontSize: 12, color: "#34856c" },
  error: { marginTop: 12, fontSize: 12, color: "#b94d61" },
  errorBox: {
    padding: 14,
    borderRadius: 13,
    backgroundColor: "#fff",
    marginBottom: 12,
  },
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
  modalTitle: { flex: 1, fontSize: 18, fontWeight: "700", color: "#20334f" },
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
  detail: { paddingTop: 16 },
  detailRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#edf1f8",
  },
});

const incentiveStyles = StyleSheet.create({
  ...baseStyles,
  incentiveAvatar: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "#eaf0ff",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: { fontSize: 12, fontWeight: "700", color: "#345cf2" },
  headerText: { fontSize: 10, color: "#20334f", flexShrink: 1 },
  incentiveHeading: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 22,
  },
  incentiveBack: {
    width: 36,
    minHeight: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e4eaf5",
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  backGlyph: { fontSize: 24, color: "#20334f" },
  incentiveInfo: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    backgroundColor: "#eaf0ff",
    borderRadius: 13,
    marginBottom: 14,
  },
  incentiveInfoText: { fontSize: 11, lineHeight: 18, color: "#607591" },
  incentiveCard: {
    borderWidth: 1,
    borderColor: "#e4eaf5",
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
  },
  incentiveBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: "#def6ef",
  },
  pendingBadge: { backgroundColor: "#fff1db" },
  incentiveBadgeText: { fontSize: 9, fontWeight: "600", color: "#405573" },
  incentiveAmountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 16,
    marginBottom: 8,
  },
  incentiveLabel: { fontSize: 12, color: "#20334f" },
  pipelineButton: {
    minHeight: 44,
    borderRadius: 13,
    backgroundColor: "#eaf0ff",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  incentiveFooter: {
    fontSize: 9,
    color: "#8192ad",
    textAlign: "center",
    marginTop: 32,
  },
});

const reviewStyles = StyleSheet.create({
  ...incentiveStyles,
  incentiveHeading: { ...incentiveStyles.incentiveHeading, marginBottom: 0 },
  csvButton: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#dce5f3",
    backgroundColor: "#fff",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewCard: {
    padding: 18,
    borderWidth: 1,
    borderColor: "#e4eaf5",
    backgroundColor: "#fff",
    borderRadius: 18,
    marginBottom: 14,
  },
  reviewTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#20334f",
    marginBottom: 6,
  },
  reviewRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    paddingVertical: 14,
  },
  reviewLabel: { fontSize: 12, color: "#20334f", flex: 1 },
  reviewValue: {
    fontSize: 12,
    fontWeight: "700",
    color: "#20334f",
    flexShrink: 1,
  },
  reviewTotal: {
    paddingHorizontal: 14,
    paddingVertical: 18,
    backgroundColor: "#eef7f4",
    borderRadius: 12,
    marginVertical: 8,
    flexWrap: "wrap",
  },
  reviewTotalText: { fontSize: 16, fontWeight: "800", color: "#138f80" },
  reconciled: {
    padding: 14,
    borderRadius: 13,
    backgroundColor: "#e6f4ee",
    marginBottom: 14,
  },
  reconciledText: { fontSize: 11, color: "#34856c", lineHeight: 18 },
  reviewDetails: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 20,
    paddingVertical: 14,
  },
  reviewDetail: { width: "50%", paddingRight: 12 },
  fullDetail: { width: "100%" },
  reviewDetailLabel: {
    fontSize: 9,
    color: "#71829c",
    marginBottom: 7,
    letterSpacing: 0.6,
  },
  reviewDetailValue: {
    fontSize: 12,
    color: "#20334f",
    fontWeight: "600",
    lineHeight: 18,
  },
  reviewSubmit: { marginBottom: 8 },
  pdfButton: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: "#dce5f3",
    backgroundColor: "#fff",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
  },
});

const paymentStyles = StyleSheet.create({
  ...incentiveStyles,
  title: { ...baseStyles.title, fontSize: 24 },
  paymentScope: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e4eaf5",
    backgroundColor: "#fff",
    marginBottom: 16,
  },
  paymentEmpty: {
    paddingHorizontal: 22,
    paddingVertical: 28,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e4eaf5",
    backgroundColor: "#fff",
    alignItems: "center",
  },
  emptySearch: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#eaf0ff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  paymentEmptyTitle: {
    color: "#20334f",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
  paymentEmptyText: {
    color: "#71829c",
    fontSize: 12,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 8,
  },
  openPayroll: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 13,
    backgroundColor: "#345cf2",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
  },
});

// Payroll inputs editor integrated into the Payroll route.
type EmbeddedShift = {
  id: string;
  employeeId: string;
  date: string;
  branch?: string;
  needsReview?: boolean;
};
function EmbeddedPayrollInputsPage() {
  const workspaceScope = useAdminScope();
  const { styles, contentWidth } = useAdminLayout(embeddedInputStyles, "page");
  const { width: viewportWidth } = useWindowDimensions();
  const columns = viewportWidth >= 1200 ? 3 : viewportWidth >= 600 ? 2 : 1;
  const recordCardStyle = {
    width: (contentWidth - (columns - 1) * 12) / columns,
    marginBottom: 0,
    minWidth: 0,
  };
  const router = useRouter();
  const params = useLocalSearchParams<{ branch?: string; period?: string }>();
  const [branch, setBranch] = useState(
    typeof params.branch === "string" ? params.branch : "",
  );
  useEffect(() => { if (workspaceScope) setBranch(workspaceScope.branches.find(item => item.id === workspaceScope.branchId)?.name ?? ""); }, [workspaceScope]);
  const period =
    typeof params.period === "string" &&
    /^\d{4}-(0[1-9]|1[0-2])$/.test(params.period)
      ? params.period
      : currentMonth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [shifts, setShifts] = useState<EmbeddedShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useToastState("", 'error');
  const [attempt, setAttempt] = useState(0);
  const [picker, setPicker] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [gross, setGross] = useState("");
  const [deductions, setDeductions] = useState("");
  const [incentives, setIncentives] = useState("");
  const [revisionReason, setRevisionReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useToastState("", 'error');
  const [notice, setNotice] = useToastState("", 'success');
  const savingRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setError("");
      Promise.all([getEmployees(), readPayroll(), readTeamAttendance()])
        .then(([team, pay, attendance]) => {
          if (active) {
            setEmployees(team);
            setRecords(pay);
            setShifts(
              attendance.map((item, i) => ({
                id: String(i) + ":" + item.employeeId + ":" + item.date,
                employeeId: item.employeeId,
                date: item.date,
                branch: item.branch,
                needsReview: item.needsReview,
              })),
            );
          }
        })
        .catch((reason) => {
          if (active)
            setError(
              reason instanceof Error
                ? reason.message
                : "Could not load payroll inputs.",
            );
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [attempt]),
  );

  const {
    branches: availableBranches,
    loading: branchesLoading,
    error: branchesError,
    refresh: refreshBranches,
  } = useAvailableBranches();
  const branches = availableBranches.map((item) => item.name);
  useEffect(() => {
    if (
      !branchesLoading &&
      !branchesError &&
      branch &&
      !availableBranches.some((item) => item.name === branch)
    )
      setBranch("");
  }, [availableBranches, branchesLoading, branchesError, branch]);
  const team = employees.filter(
    (employee) =>
      employee.status !== "inactive" && (!branch || employee.branch === branch),
  );
  const payrollFor = (employee: Employee) =>
    records.find(
      (record) =>
        record.employeeId === employee.id &&
        record.period === period &&
        (!branch || (record.branch || employee.branch) === branch),
    );
  const inputChecks = team.filter((employee) => {
    const record = payrollFor(employee);
    return (
      !record ||
      record.gross < 0 ||
      record.deductions < 0 ||
      record.deductions > record.gross ||
      (record.incentives || 0) < 0
    );
  });
  const attendanceChecks = shifts.filter(
    (shift) =>
      shift.needsReview &&
      shift.date.slice(0, 7) === period &&
      team.some((employee) => employee.id === shift.employeeId) &&
      (!branch ||
        (shift.branch ||
          employees.find((employee) => employee.id === shift.employeeId)
            ?.branch) === branch),
  );
  const periodLabel = new Date(
    `${period}-01T12:00:00+05:30`,
  ).toLocaleDateString("en-GB", {
    timeZone: "Asia/Kolkata",
    month: "long",
    year: "numeric",
  });
  const back = () =>
    router.replace({ pathname: "/admin/payroll", params: { branch, period } });
  const edit = (employee: Employee) => {
    const record = payrollFor(employee);
    setEditing(employee);
    setGross(record ? String(record.gross) : "");
    setDeductions(record ? String(record.deductions) : "");
    setIncentives(record ? String(record.incentives || 0) : "");
    setRevisionReason("");
    setSaveError("");
  };
  const save = async () => {
    if (!editing || savingRef.current) return;
    setSaveError("");
    if (
      !/^\d+(\.\d{1,2})?$/.test(gross.trim()) ||
      !/^\d+(\.\d{1,2})?$/.test(deductions.trim()) ||
      (incentives.trim() !== "" && !/^\d+(\.\d{1,2})?$/.test(incentives.trim()))
    ) {
      setSaveError(
        "Enter gross and deductions as non-negative amounts with up to two decimal places.",
      );
      return;
    }
    if (Number(deductions) > Number(gross)) {
      setSaveError("Deductions cannot exceed gross earnings.");
      return;
    }
    const previous = payrollFor(editing);
    const changed =
      !!previous &&
      (Math.round(previous.gross * 100) !== Math.round(Number(gross) * 100) ||
        Math.round(previous.deductions * 100) !==
          Math.round(Number(deductions) * 100));
    if (
      changed &&
      (revisionReason.trim().length < 5 || revisionReason.trim().length > 500)
    ) {
      setSaveError("Enter a salary revision reason (5–500 characters).");
      return;
    }
    savingRef.current = true;
    setSaving(true);
    try {
      const updated = await savePayroll(
        {
          employeeId: editing.id,
          employeeName: editing.fullName,
          branch: editing.branch,
          period,
          gross: Number(gross),
          deductions: Number(deductions),
          incentives: Number(incentives || 0),
        },
        revisionReason,
      );
      setRecords(updated);
      setEditing(null);
      setNotice(
        "Salary saved to the backend. Reload payroll before calculating the run.",
      );
    } catch (reason) {
      setSaveError(
        reason instanceof Error
          ? reason.message
          : "Could not save payroll inputs.",
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.safe}>
      <View style={styles.page}>
        {editing ? (
          <View style={styles.inlineEditor}>
            <View style={styles.editorHeader}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back to payroll inputs"
                disabled={saving}
                onPress={() => setEditing(null)}
                style={styles.editorBack}
              >
                <AppIcon symbol="‹" style={styles.chevron} />
              </Pressable>
              <View style={styles.flex}>
                <Text style={styles.editorTitle}>{editing.fullName}</Text>
                <Text style={styles.subtitle}>
                  {periodLabel} · {branch || editing.branch}
                </Text>
              </View>
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.inlineEditorContent}
            >
              <View style={styles.fieldGroup}>
                <TextInput
                  validation={{ required: true, min: 0 }}
                  label="Base gross earnings (INR) *"
                  accessibilityLabel="Gross earnings"
                  value={gross}
                  onChangeText={setGross}
                  editable={!saving}
                  keyboardType="decimal-pad"
                  style={styles.input}
                />
                <TextInput
                  validation={{
                    required: true,
                    min: 0,
                    max: Number(gross) || 0,
                  }}
                  label="Deductions (INR) *"
                  accessibilityLabel="Deductions"
                  value={deductions}
                  onChangeText={setDeductions}
                  editable={!saving}
                  keyboardType="decimal-pad"
                  style={styles.input}
                />
                <TextInput
                  validation={{ min: 0 }}
                  label="Sales incentives (INR)"
                  accessibilityLabel="Sales incentives"
                  value={incentives}
                  onChangeText={setIncentives}
                  editable={!saving}
                  keyboardType="decimal-pad"
                  style={styles.input}
                />
              </View>
              {payrollFor(editing) && (
                <View style={styles.revisionReasonField}>
                  <TextInput
                    validation={{ required: true }}
                    label="Salary revision reason *"
                    accessibilityLabel="Salary revision reason"
                    value={revisionReason}
                    onChangeText={setRevisionReason}
                    editable={!saving}
                    multiline
                    maxLength={500}
                    textAlignVertical="top"
                    style={[styles.input, styles.reasonInput]}
                  />
                </View>
              )}
              {saveError !== "" && (
                <Text accessibilityLiveRegion="polite" style={styles.error}>
                  {saveError}
                </Text>
              )}
            </ScrollView>
            <View style={styles.inlineEditorFooter}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Save payroll inputs"
                disabled={saving}
                onPress={() => void save()}
                style={[styles.submit, saving && styles.dim]}
              >
                <Text style={styles.submitText}>
                  {saving ? "Saving…" : "Save inputs"}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}
          >
            <AdminPageHeading title="Branch payroll inputs" onBack={back} />
            <View style={styles.branchCard}>
              <View style={styles.dot} />
              <View style={styles.flex}>
                <Text style={styles.name}>{branch || "All branches"}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Change branch"
                onPress={() => setPicker(true)}
                style={styles.change}
              >
                <Text style={styles.link}>Change</Text>
              </Pressable>
            </View>

            {loading ? (
              <ActivityIndicator
                accessibilityLabel="Loading payroll inputs"
                color="#345cf2"
                style={styles.change}
              />
            ) : error ? (
              <View style={styles.checkCard}>
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
                <Text style={styles.sectionTitle}>Pre-payroll checks</Text>
                <View style={styles.recordGrid}>
                  {attendanceChecks.map((shift) => (
                    <View
                      key={shift.id}
                      style={[styles.checkCard, recordCardStyle]}
                    >
                      <View style={styles.row}>
                        <Text style={[styles.name, styles.flex]}>
                          {employees.find(
                            (employee) => employee.id === shift.employeeId,
                          )?.fullName || "Unknown employee"}
                        </Text>
                        <View style={styles.statusBadge}>
                          <Text style={styles.small}>Attendance</Text>
                        </View>
                      </View>
                      <Text style={styles.checkDescription}>
                        Attendance confirmation required for {shift.date}
                      </Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Review attendance ${shift.id}`}
                        onPress={() =>
                          router.push({
                            pathname: "/admin/attendance/team",
                            params: { branch },
                          })
                        }
                        style={styles.resolve}
                      >
                        <Text style={styles.buttonText}>
                          Review attendance check
                        </Text>
                      </Pressable>
                    </View>
                  ))}
                  {inputChecks.map((employee) => (
                    <View
                      key={employee.id}
                      style={[styles.checkCard, recordCardStyle]}
                    >
                      <View style={styles.row}>
                        <Text style={[styles.name, styles.flex]}>
                          {employee.fullName}
                        </Text>
                        <View style={styles.statusBadge}>
                          <Text style={styles.small}>Payroll</Text>
                        </View>
                      </View>
                      <Text style={styles.checkDescription}>
                        {payrollFor(employee)
                          ? "Verify gross earnings, deductions and incentives."
                          : "Employee payroll inputs are missing for this period."}
                      </Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Resolve payroll check ${employee.fullName}`}
                        onPress={() => edit(employee)}
                        style={styles.resolve}
                      >
                        <Text style={styles.buttonText}>Resolve check</Text>
                      </Pressable>
                    </View>
                  ))}
                  {attendanceChecks.length + inputChecks.length === 0 && (
                    <View style={styles.checkCard}>
                      <Text style={styles.name}>
                        {team.length
                          ? "No checks to resolve"
                          : "No employees in this branch"}
                      </Text>
                      <Text style={styles.subtitle}>
                        {team.length
                          ? "Verify the saved employee earnings below."
                          : "Your employees and payroll checks will appear here."}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={styles.sectionTitle}>Employee earnings</Text>
                <View style={styles.recordGrid}>
                  {team.map((employee) => {
                    const record = payrollFor(employee);
                    return (
                      <View
                        key={employee.id}
                        style={[styles.checkCard, recordCardStyle]}
                      >
                        <View style={styles.row}>
                          <View style={styles.flex}>
                            <Text style={styles.name}>{employee.fullName}</Text>
                            <Text style={styles.subtitle}>
                              {[employee.branch, employee.department]
                                .filter(Boolean)
                                .join(" · ")}
                            </Text>
                          </View>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Edit payroll ${employee.fullName}`}
                            onPress={() => edit(employee)}
                            style={styles.change}
                          >
                            <Text style={styles.link}>
                              {record ? "Edit" : "Add inputs"}
                            </Text>
                          </Pressable>
                        </View>
                        <Text style={styles.subtitle}>
                          Base gross {record ? money(record.gross) : "—"} ·
                          Incentive{" "}
                          {record ? money(record.incentives || 0) : "—"}
                        </Text>
                        <Text style={styles.subtitle}>
                          Deductions {record ? money(record.deductions) : "—"}
                        </Text>
                        <Text style={styles.name}>
                          Estimated net{" "}
                          {record
                            ? money(
                                grossWithIncentive(record) - record.deductions,
                              )
                            : "—"}
                        </Text>
                      </View>
                    );
                  })}
                </View>
                {notice !== "" && (
                  <Text accessibilityLiveRegion="polite" style={styles.notice}>
                    {notice}
                  </Text>
                )}
              </>
            )}
          </ScrollView>
        )}
        <AdminBottomNavigation />
      </View>
      <Modal
        transparent
        visible={picker}
        animationType="fade"
        onRequestClose={() => setPicker(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.row}>
              <Text style={styles.modalTitle}>Choose branch</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close branch picker"
                onPress={() => setPicker(false)}
                style={styles.close}
              >
                <AppIcon symbol="×" style={styles.chevron} />
              </Pressable>
            </View>
            <ScrollView>
              <BranchOptionsStatus
                loading={branchesLoading}
                error={branchesError}
                empty={branches.length === 0}
                onRetry={refreshBranches}
              />
              {["", ...branches].map((value) => (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  accessibilityLabel={value || "All branches"}
                  onPress={() => {
                    setBranch(value);
                    void selectAdminBranch(availableBranches.find((item) => item.name === value)?.id ?? null);
                    router.setParams({ branch: value });
                    setPicker(false);
                  }}
                  style={styles.option}
                >
                  <Text style={styles.name}>{value || "All branches"}</Text>
                  <AppIcon
                    symbol={branch === value ? "✓" : ""}
                    style={styles.link}
                  />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const embeddedInputStyles = StyleSheet.create({
  inlineEditor: { flex: 1, minHeight: 0, backgroundColor: "#f6f8fd" },
  editorHeader: {
    minHeight: 76,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e4eaf5",
  },
  editorBack: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#f5f7fc",
  },
  editorTitle: { fontSize: 17, fontWeight: "700", color: "#20334f" },
  inlineEditorContent: {
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
    padding: 18,
    paddingBottom: 24,
  },
  fieldGroup: { gap: 12 },
  revisionReasonField: { marginTop: 14 },
  inlineEditorFooter: {
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
    padding: 16,
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e4eaf5",
  },
  recordGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  companyFilterName: {
    fontSize: 10,
    color: "#20334f",
    fontWeight: "600",
    flexShrink: 1,
  },
  reasonInput: { minHeight: 88, paddingVertical: 12 },
  back: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e4eaf5",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  tip: {
    backgroundColor: "#fff4e2",
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
  },
  tipText: { fontSize: 11, lineHeight: 18, color: "#98661e" },
  sectionTitle: {
    marginTop: 22,
    marginBottom: 12,
    fontSize: 16,
    fontWeight: "700",
    color: "#20334f",
  },
  checkCard: {
    marginBottom: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e0e8f5",
    borderRadius: 17,
    backgroundColor: "#fff",
  },
  checkDescription: {
    fontSize: 12,
    lineHeight: 20,
    color: "#7a8ba5",
    marginTop: 16,
  },
  resolve: {
    marginTop: 14,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#dce5f3",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { fontSize: 11, fontWeight: "600", color: "#405573" },
  inputLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#405573",
    marginTop: 16,
    marginBottom: 8,
  },
  input: {
    minHeight: 46,
    paddingHorizontal: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#dce5f3",
    backgroundColor: "#fcfdff",
    fontSize: 14,
    color: "#20334f",
  },
  saveButton: { marginTop: 20 },
  safe: { flex: 1, backgroundColor: "#f6f8fd" },
  page: { flex: 1, width: "100%", maxWidth: 960, alignSelf: "center" },
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
  period: { minHeight: 32, justifyContent: "center" },
  branchCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e4eaf5",
    borderRadius: 17,
    backgroundColor: "#fff",
    marginTop: 14,
  },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#39b8a7" },
  name: { fontSize: 12, fontWeight: "700", color: "#20334f" },
  change: { minHeight: 44, paddingHorizontal: 8, justifyContent: "center" },
  link: { fontSize: 10, fontWeight: "600", color: "#345cf2" },
  steps: { flexDirection: "row", marginVertical: 16 },
  step: { flex: 1, alignItems: "center", gap: 6 },
  stepCircle: {
    width: 25,
    height: 25,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e7edf7",
  },
  activeStep: { backgroundColor: "#345cf2" },
  stepNumber: { fontSize: 10, color: "#7a8ba5", fontWeight: "600" },
  white: { color: "#fff" },
  stepLabel: { fontSize: 9, color: "#607591" },
  runCard: {
    padding: 20,
    borderRadius: 20,
    backgroundColor: "#eeedfc",
    borderWidth: 1,
    borderColor: "#e2e6fc",
    marginBottom: 16,
  },
  runLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1,
    color: "#345cf2",
  },
  statusBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#fff1d9",
  },
  net: { fontSize: 32, fontWeight: "800", color: "#20334f", marginTop: 16 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 16 },
  metric: {
    width: "46%",
    flexGrow: 1,
    padding: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e0e8f5",
    borderRadius: 16,
    alignItems: "flex-start",
    justifyContent: "center",
    paddingVertical: 16,
    minWidth: 0,
  },
  metricLabel: {
    fontSize: 10,
    color: "#607591",
    textAlign: "left",
    flexShrink: 1,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: "800",
    color: "#20334f",
    marginVertical: 7,
    textAlign: "left",
    flexShrink: 1,
  },
  workspace: {
    width: "46%",
    flexGrow: 1,
    borderWidth: 1,
    borderColor: "#e0e8f5",
    borderRadius: 18,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  workspaceBody: { padding: 14, minHeight: 144 },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  glyph: { fontSize: 23 },
  countBadge: {
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: "#f2f5fc",
  },
  workspaceTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#20334f",
    marginTop: 14,
  },
  workspaceFooter: {
    minHeight: 36,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#f0f3f9",
    backgroundColor: "#fcfdff",
  },
  submit: {
    minHeight: 46,
    borderRadius: 13,
    backgroundColor: "#345cf2",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  submitText: { fontSize: 12, fontWeight: "700", color: "#fff" },
  dim: { opacity: 0.5 },
  notice: { marginTop: 12, fontSize: 12, color: "#34856c" },
  error: { marginTop: 12, fontSize: 12, color: "#b94d61" },
  errorBox: {
    padding: 14,
    borderRadius: 13,
    backgroundColor: "#fff",
    marginBottom: 12,
  },
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
  modalTitle: { flex: 1, fontSize: 18, fontWeight: "700", color: "#20334f" },
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
  detail: { paddingTop: 16 },
  detailRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#edf1f8",
  },
});
