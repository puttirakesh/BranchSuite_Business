import { useToastState } from '../../ui/useToastState';
import { apiErrorMessage as apiError } from '../../core/admin/http';

import {
  BackHandler,
  Platform,
  ScrollView,
  View,
  useWindowDimensions,
} from "react-native";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  useFocusEffect,
  usePathname,
  useRouter,
  type Href,
} from "expo-router";

import {
  Page,
  Task,
  EmployeeDocument,
  Records,
  dayKey,
  validDate,
  leaveDays,
  initialRecords,
} from "./data";

import { useAuth } from "../../core/auth/AuthProvider";
import { api } from '../../core/api/client';

import {
  getEmployeeProfiles,
  type EmployeeProfile,
} from "./employee-profile.api";

import {
  attendanceApi,
  leaveApi,
  type AttendanceDto,
  type LeaveTypeDto,
  type LeaveRequestDto,
  type LeaveBalanceDto,
} from "../../core/admin/api";

// =====================================================
// ROUTES
// =====================================================

const employeeRoutes = {
  home: "/employee/dashboard",
  attendance: "/employee/attendance",
  leave: "/employee/leave",
  tasks: "/employee/tasks",
  payroll: "/employee/payslips",
  profile: "/employee/profile",
  documents: "/employee/documents",
  advances: "/employee/advances",
  help: "/employee/help",
} as const satisfies Record<Page, Href>;

// =====================================================
// TYPES
// =====================================================

type LeaveTypeOption = {
  id: string;
  name: string;
  code: string;
  annualAllowance: number;
  isPaid: boolean;
};

type PayslipItem = {
  id: string;
  month: string;
  year: number;
  grossPay: number;
  netPay: number;
  netSalary?: number;
  deductions: number;
  run: {
    status: string;
    period: {
      month: number;
      year: number;
    };
  };
  payment?: {
    paidAt?: string | null;
  } | null;
};

type AttendanceShift = {
  id: string;
  date: string;
  inTime: string;
  outTime: string;
  status: AttendanceDto["status"];
};

// =====================================================
// HELPERS
// =====================================================

function pageForPath(pathname: string): Page {
  return (
    (Object.keys(employeeRoutes) as Page[]).find(
      (page) =>
        employeeRoutes[page] ===
        pathname.replace(/\/$/, ""),
    ) ?? "home"
  );
}

function formatAttendanceTime(
  value: string | null,
): string {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}



function dateOnly(value: string): string {
  return value.slice(0, 10);
}

function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function numberOfDaysInYear(
  request: LeaveRequestDto,
  year: number,
): number {
  const first = `${year}-01-01`;
  const last = `${year}-12-31`;

  const from = dateOnly(request.startDate);
  const to = dateOnly(request.endDate);

  if (to < first || from > last) {
    return 0;
  }

  const clippedFrom =
    from < first ? first : from;

  const clippedTo =
    to > last ? last : to;

  if (
    clippedFrom === from &&
    clippedTo === to
  ) {
    return Number(request.days) || 0;
  }

  return leaveDays(
    clippedFrom,
    clippedTo,
  );
}

// =====================================================
// WORKSPACE STATE
// =====================================================

function useWorkspaceState() {
  const { width } = useWindowDimensions();

  const compact = width < 768;
  const desktop = Platform.OS === 'web' && width >= 1200;
  const tablet = width >= 768 && !desktop;
  const splitLayout = tablet || desktop;

  const router = useRouter();
  const pathname = usePathname();

  const page: Page = pageForPath(pathname);

  const { session, signOut } = useAuth();

  // ===================================================
  // EMPLOYEE PROFILE
  // ===================================================

  const [employeeProfiles, setEmployeeProfiles] =
    useState<EmployeeProfile[]>([]);

  const [profileLoading, setProfileLoading] =
    useState(true);

  const [profileError, setProfileError] =
    useState<string | null>(null);
  const [profileReload, setProfileReload] = useState(0);
  const refreshProfile = () => setProfileReload(value => value + 1);
  const [selectedProfileId, setSelectedProfileId] = useState('');

  const assignedProfiles = employeeProfiles.filter(
    (profile) => profile.status === 'ACTIVE' &&
      session?.memberships?.some(
        (membership) =>
          membership.companyId ===
          profile.companyId &&
          membership.branches.some(
            (branch) =>
              branch.id === profile.branchId,
          ),
      ),
  );

  // Always derive the selected assignment from the authenticated memberships.
  const employeeProfile =
    assignedProfiles.length === 1
      ? assignedProfiles[0]
      : assignedProfiles.find(profile => profile.id === selectedProfileId) ?? null;

  const employeeName =
    employeeProfile?.user?.name ??
    session?.user?.name ??
    "Employee";

  const employeeEmail =
    employeeProfile?.workEmail ??
    employeeProfile?.user?.email ??
    session?.user?.email ??
    "";

  const employeeId =
    employeeProfile?.employeeCode ?? "";

  const employeeBranch =
    employeeProfile?.branch?.name ??
    "Not assigned";

  const employeeDepartment =
    employeeProfile?.department ??
    "Not assigned";

  const employeeManager = employeeProfile?.branch?.manager?.trim() || 'Not assigned';

  const employeePhone =
    employeeProfile?.user?.phone ??
    "Not available";

  const employeeDesignation =
    employeeProfile?.designation ??
    "Not assigned";

  const employeeCompany =
    employeeProfile?.company?.name ??
    "Not assigned";

  useEffect(() => {
    let cancelled = false;

    if (!session?.user?.id) {
      setEmployeeProfiles([]);
      setProfileError(null);
      setProfileLoading(false);
      return;
    }

    async function loadEmployeeProfile() {
      setProfileLoading(true);
      setProfileError(null);
      setEmployeeProfiles([]);

      try {
        const profiles =
          await getEmployeeProfiles();

        if (cancelled) return;

        if (!Array.isArray(profiles)) {
          throw new Error(
            "Invalid employee profile response.",
          );
        }

        setEmployeeProfiles(profiles);
      } catch (error) {
        if (!cancelled) {
          console.error(
            "Employee profile API:",
            error,
          );

          setProfileError(
            "Unable to load employee details. Check your backend connection.",
          );
        }
      } finally {
        if (!cancelled) {
          setProfileLoading(false);
        }
      }
    }

    void loadEmployeeProfile();

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, profileReload]);

  // ===================================================
  // SHARED WORKSPACE STATE
  // ===================================================

  const [signedOut, setSignedOut] =
    useState(false);

  const [advanceAmount, setAdvanceAmount] =
    useState("");

  const [advanceReason, setAdvanceReason] =
    useState("");

  const [advanceError, setAdvanceError] =
    useToastState("", 'error');

  const [records, setRecords] =
    useState<Records>(initialRecords);

  const loaded = true;

  const [message, setMessage] =
    useToastState("", 'info');

  const storageError = false;

  const [dialog, setDialog] = useState<
    | "leave"
    | "payslip"
    | "task"
    | "search"
    | "document"
    | "cancelLeave"
    | null
  >(null);

  const [cancelLeaveId, setCancelLeaveId] =
    useState<string | null>(null);

  const [activeDocument, setActiveDocument] =
    useState<EmployeeDocument | null>(null);

  const [savingDocument, setSavingDocument] =
    useState(false);

  const [activeTask, setActiveTask] =
    useState<Task | null>(null);

  const [taskStatus, setTaskStatus] =
    useState<Task["status"]>("Open");

  const [taskNote, setTaskNote] =
    useState("");

  const [filter, setFilter] =
    useState("All");

  const [query, setQuery] =
    useState("");

  const [leaveType, setLeaveType] =
    useState("Casual leave");

  const [from, setFrom] =
    useState(dayKey());

  const [to, setTo] =
    useState(dayKey());

  const [reason, setReason] =
    useState("");

  const [formError, setFormError] =
    useToastState("", 'error');

  const [today, setToday] =
    useState(dayKey());

  // Existing payroll integration is unchanged.
  const [payslips, setPayslips] =
    useState<PayslipItem[]>([]);
  const [payslipsLoading, setPayslipsLoading] = useState(false);
  const [payslipsError, setPayslipsError] = useToastState('', 'error');

  useFocusEffect(useCallback(() => {
    let active = true;
    if (!session?.user.id) return;
    setPayslipsLoading(true); setPayslipsError('');
    api.get('/payroll/my-payslips').then(response => {
      if (!Array.isArray(response.data)) throw new Error('Could not read payslips.');
      const items: PayslipItem[] = response.data.map(entry => ({
        id: entry.id, month: String(entry.run.period.month), year: entry.run.period.year,
        grossPay: Number(entry.grossAmount), netPay: Number(entry.netAmount), deductions: Number(entry.deductionsAmount), run: entry.run, payment: entry.payment,
      })).sort((a, b) => b.year - a.year || Number(b.month) - Number(a.month));
      if (active) setPayslips(items);
    }).catch(cause => { if (active) { setPayslips([]); setPayslipsError(apiError(cause, 'Unable to load payslips.')); } })
      .finally(() => { if (active) setPayslipsLoading(false); });
    return () => { active = false; };
  }, [session?.user.id]));

  const scroll = useRef<ScrollView>(null);
  const blurTarget = useRef<View>(null);

  // ===================================================
  // EMPLOYEE SCOPE
  // ===================================================

  const employeeUserId =
    session?.user?.id;

  const employeeCompanyId =
    employeeProfile?.companyId;

  const employeeBranchId =
    employeeProfile?.branchId;


  useEffect(() => {
    if (!employeeUserId) return;

    console.log("[EMPLOYEE SCOPE]", {
      employeeUserId,
      employeeCompanyId,
      employeeBranchId,
      employeeProfileId: employeeProfile?.id,
      profileLoading,
      profileError,
    });
  }, [
    employeeUserId,
    employeeCompanyId,
    employeeBranchId,
    employeeProfile?.id,
    profileLoading,
    profileError,
  ]);


  // ===================================================
  // ATTENDANCE STATE
  // ===================================================

  const [attendanceHistory, setAttendanceHistory] =
    useState<AttendanceDto[]>([]);

  const [attendanceLoading, setAttendanceLoading] =
    useState(false);

  const [attendanceSaving, setAttendanceSaving] =
    useState(false);

  const [attendanceError, setAttendanceError] =
    useToastState("", 'error');

  const attendanceBusy = useRef(false);
  const [attendanceReload, setAttendanceReload] = useState(0);
  const refreshAttendance = () => setAttendanceReload(value => value + 1);

  // Match the backend's UTC calendar date.
  const attendanceToday = utcToday();

  // ===================================================
  // LOAD ATTENDANCE
  // ===================================================

  useFocusEffect(
    useCallback(() => {
      let active = true;

      if (
        !employeeUserId ||
        !employeeCompanyId ||
        !employeeBranchId
      ) {
        setAttendanceHistory([]);
        setAttendanceError("");
        setAttendanceLoading(false);

        return () => {
          active = false;
        };
      }

      async function loadAttendance() {
        setAttendanceLoading(true);
        setAttendanceError("");

        try {
          const history =
            await attendanceApi.mine({});

          if (!active) return;

          if (!Array.isArray(history)) {
            throw new Error(
              "Invalid attendance API response.",
            );
          }

          const scopedHistory =
            history.filter(
              (entry) =>
                entry.companyId ===
                employeeCompanyId &&
                entry.branchId ===
                employeeBranchId &&
                entry.userId ===
                employeeUserId,
            );

          setAttendanceHistory(scopedHistory);
        } catch (error) {
          if (!active) return;

          setAttendanceError(
            apiError(
              error,
              "Unable to load attendance.",
            ),
          );

          setAttendanceHistory([]);
        } finally {
          if (active) {
            setAttendanceLoading(false);
          }
        }
      }

      void loadAttendance();

      return () => {
        active = false;
      };
    }, [
      employeeUserId,
      employeeCompanyId,
      employeeBranchId,
      attendanceReload,
    ]),
  );

  // ===================================================
  // ATTENDANCE DISPLAY
  // ===================================================

  const attendanceShifts: AttendanceShift[] =
    attendanceHistory.map((entry) => ({
      id: entry.id,
      date: dateOnly(
        entry.attendanceDate,
      ),
      inTime: formatAttendanceTime(
        entry.checkInAt,
      ),
      outTime: formatAttendanceTime(
        entry.checkOutAt,
      ),
      status: entry.status,
    }));

  const shift =
    attendanceShifts.find(
      (item) =>
        item.date === attendanceToday,
    ) ?? null;

  const canCheckOut =
    shift !== null &&
    shift.status === "PRESENT" &&
    Boolean(shift.inTime) &&
    !shift.outTime;

  const canCheckIn =
    shift === null;

  // ===================================================
  // CHECK-IN / CHECK-OUT
  // ===================================================

  async function checkAttendance() {
    if (attendanceBusy.current) {
      return;
    }

    if (
      !employeeUserId ||
      !employeeProfile ||
      !employeeCompanyId ||
      !employeeBranchId
    ) {
      setMessage(
        "A valid employee account, company and branch are required.", 'error',
      );
      return;
    }

    if (
      attendanceLoading ||
      attendanceSaving ||
      attendanceError
    ) {
      setMessage(
        attendanceError ||
        "Attendance is still loading. Please try again.",
      );
      return;
    }

    if (shift && !canCheckOut) {
      go("attendance");
      return;
    }

    if (
      !canCheckIn &&
      !canCheckOut
    ) {
      setMessage(
        "Today's attendance is already recorded.",
      );
      return;
    }

    const currentUtcDate =
      utcToday();

    if (
      currentUtcDate !==
      attendanceToday
    ) {
      setMessage(
        "The attendance date has changed. Reopen the screen before recording attendance.",
      );
      return;
    }

    attendanceBusy.current = true;
    setAttendanceSaving(true);

    const checkingOut = canCheckOut;

    try {
      const result = checkingOut
        ? await attendanceApi.checkOut(
          employeeCompanyId,
          employeeBranchId,
        )
        : await attendanceApi.checkIn(
          employeeCompanyId,
          employeeBranchId,
        );

      if (
        result.userId !== employeeUserId ||
        result.companyId !== employeeCompanyId ||
        result.branchId !== employeeBranchId
      ) {
        throw new Error(
          "Attendance was recorded, but the returned record did not match your employee scope. Refresh attendance before retrying.",
        );
      }

      setAttendanceHistory(
        (current) => {
          const existing =
            current.some(
              (entry) =>
                entry.id === result.id,
            );

          return existing
            ? current.map(
              (entry) =>
                entry.id === result.id
                  ? result
                  : entry,
            )
            : [result, ...current];
        },
      );

      setAttendanceError("");

      setMessage(
        checkingOut
          ? "Check out recorded successfully."
          : "Check in recorded successfully.", 'success',
      );
    } catch (error) {
      // Re-fetch because a failed network response
      // does not guarantee that the write failed.
      try {
        const latest =
          await attendanceApi.mine({});

        if (!Array.isArray(latest)) {
          throw new Error(
            "Invalid attendance API response.",
          );
        }

        const scopedHistory =
          latest.filter(
            (entry) =>
              entry.companyId ===
              employeeCompanyId &&
              entry.branchId ===
              employeeBranchId &&
              entry.userId ===
              employeeUserId,
          );

        setAttendanceHistory(
          scopedHistory,
        );

        setAttendanceError("");
      } catch (refreshError) {
        console.error(
          "Unable to refresh attendance:",
          refreshError,
        );

        setAttendanceError(
          "Attendance could not be refreshed. Reopen the screen before trying again.",
        );
      }

      setMessage(
        apiError(
          error,
          "Unable to record attendance. Check your history before retrying.",
        ), 'error',
      );
    } finally {
      attendanceBusy.current = false;
      setAttendanceSaving(false);
    }
  }

  // ===================================================
  // LEAVE MANAGEMENT
  // ===================================================

  const [leaveTypes, setLeaveTypes] =
    useState<LeaveTypeOption[]>([]);

  const [leaveRequests, setLeaveRequests] =
    useState<LeaveRequestDto[]>([]);

  const [leaveBalances, setLeaveBalances] =
    useState<LeaveBalanceDto[]>([]);

  const [leaveLoading, setLeaveLoading] =
    useState(false);

  const [leaveSaving, setLeaveSaving] =
    useState(false);

  const [leaveError, setLeaveError] =
    useToastState("", 'error');

  const [leaveRefresh, setLeaveRefresh] =
    useState(0);

  const leaveBusy = useRef(false);

  const refreshLeave = useCallback(() => {
    setLeaveRefresh(
      (current) => current + 1,
    );
  }, []);

  // ===================================================
  // LOAD LEAVE FROM POSTGRESQL
  // ===================================================

  useFocusEffect(
    useCallback(() => {
      let active = true;

      if (
        !employeeUserId ||
        !employeeCompanyId ||
        !employeeBranchId
      ) {
        setLeaveTypes([]);
        setLeaveRequests([]);
        setLeaveBalances([]);
        setLeaveLoading(false);

        setLeaveError(
          profileLoading
            ? ""
            : "An employee company and branch must be selected.",
        );

        return () => {
          active = false;
        };
      }

      async function loadLeave() {
        setLeaveLoading(true);
        setLeaveError("");

        const year =
          new Date().getUTCFullYear();

        const [
          typesResult,
          requestsResult,
          balancesResult,
        ] = await Promise.allSettled([
          leaveApi.types(
            employeeCompanyId!,
          ),
          leaveApi.myRequests(
            employeeCompanyId!,
            employeeBranchId!,
          ),
          leaveApi.myBalances(
            employeeCompanyId!,
            employeeBranchId!,
            year,
          ),
        ] as const);

        if (!active) return;

        const errors: string[] = [];

        // ===================================================
        // LEAVE TYPES — LOAD AND VALIDATE COMPANY SCOPE
        // ===================================================

        if (typesResult.status === "fulfilled") {
          const types: LeaveTypeDto[] = typesResult.value;

          console.log("[EMPLOYEE LEAVE] API response:", {
            employeeUserId,
            employeeCompanyId,
            employeeBranchId,
            receivedTypes: types,
          });

          if (!Array.isArray(types)) {
            setLeaveTypes([]);

            errors.push(
              "Leave types: Invalid response from backend.",
            );
          } else {
            const matchingTypes = types.filter(
              (item) =>
                item.status === "ACTIVE" &&
                item.companyId === employeeCompanyId,
            );

            console.log("[EMPLOYEE LEAVE] Filter result:", {
              requestedCompanyId: employeeCompanyId,
              totalReceived: types.length,
              matchingCount: matchingTypes.length,
              rejectedTypes: types
                .filter(
                  (item) =>
                    item.status !== "ACTIVE" ||
                    item.companyId !== employeeCompanyId,
                )
                .map((item) => ({
                  id: item.id,
                  code: item.code,
                  name: item.name,
                  companyId: item.companyId,
                  status: item.status,
                })),
            });

            setLeaveTypes(
              matchingTypes.map((item) => ({
                id: item.id,
                code: item.code,
                name: item.name,
                annualAllowance: Number(
                  item.annualAllowance,
                ),
                isPaid: item.isPaid,
              })),
            );
          }
        } else {
          console.error(
            "[EMPLOYEE LEAVE] API FAILED:",
            typesResult.reason,
          );

          setLeaveTypes([]);

          errors.push(
            "Leave types: " +
            apiError(
              typesResult.reason,
              "Unable to load leave types.",
            ),
          );
        }

        // My requests
        if (
          requestsResult.status ===
          "fulfilled"
        ) {
          const requests:
            LeaveRequestDto[] =
            requestsResult.value;

          setLeaveRequests(
            requests
              .filter(
                (request) =>
                  request.companyId ===
                  employeeCompanyId &&
                  request.branchId ===
                  employeeBranchId &&
                  request.userId ===
                  employeeUserId,
              )
              .sort((a, b) =>
                b.createdAt.localeCompare(
                  a.createdAt,
                ),
              ),
          );
        } else {
          setLeaveRequests([]);

          errors.push(
            "Requests: " +
            apiError(
              requestsResult.reason,
              "Unable to load leave requests.",
            ),
          );
        }

        // Authoritative allocated balances
        if (
          balancesResult.status ===
          "fulfilled"
        ) {
          const balances:
            LeaveBalanceDto[] =
            balancesResult.value;

          setLeaveBalances(
            balances.filter(
              (balance) =>
                balance.companyId ===
                employeeCompanyId &&
                balance.userId ===
                employeeUserId &&
                balance.year === year,
            ),
          );
        } else {
          setLeaveBalances([]);

          errors.push(
            "Balances: " +
            apiError(
              balancesResult.reason,
              "Unable to load leave balances.",
            ),
          );
        }

        setLeaveError(
          errors.join(" "),
        );

        setLeaveLoading(false);
      }

      void loadLeave();

      return () => {
        active = false;
      };
    }, [
      employeeUserId,
      employeeCompanyId,
      employeeBranchId,
      profileLoading,
      leaveRefresh,
    ]),
  );

  // ===================================================
  // AUTHORITATIVE LEAVE BALANCE
  // ===================================================

  function leaveBalance(
    typeName: string,
  ): number | null {
    const selected =
      leaveTypes.find(
        (item) =>
          item.name === typeName,
      );

    if (
      !selected ||
      leaveLoading ||
      leaveError
    ) {
      return null;
    }

    const balance =
      leaveBalances.find(
        (item) =>
          item.leaveTypeId ===
          selected.id &&
          item.year ===
          new Date().getUTCFullYear(),
      );

    if (!balance) {
      return null;
    }

    return Number(
      balance.remainingDays,
    );
  }

  function pendingLeaveDays(
    typeName: string,
  ): number {
    const selected =
      leaveTypes.find(
        (item) =>
          item.name === typeName,
      );

    if (!selected) {
      return 0;
    }

    const year =
      new Date().getUTCFullYear();

    return leaveRequests
      .filter(
        (request) =>
          request.leaveTypeId ===
          selected.id &&
          request.status ===
          "PENDING",
      )
      .reduce(
        (total, request) =>
          total +
          numberOfDaysInYear(
            request,
            year,
          ),
        0,
      );
  }

  // ===================================================
  // CANCELLATION ELIGIBILITY
  // ===================================================

  function canCancelLeaveRequest(
    request: LeaveRequestDto,
  ): boolean {
    if (
      request.status === "PENDING"
    ) {
      return true;
    }

    if (
      request.status === "APPROVED" &&
      dateOnly(request.startDate) >
      utcToday()
    ) {
      return true;
    }

    return false;
  }

  // ===================================================
  // OPEN LEAVE APPLICATION
  // ===================================================

  function openLeave() {
    if (
      leaveLoading ||
      leaveSaving
    ) {
      setMessage(
        "Leave information is still loading.",
      );
      return;
    }

    if (
      leaveError ||
      leaveTypes.length === 0
    ) {
      setMessage(
        leaveError ||
        "No active leave types have been configured.",
      );
      return;
    }

    const earliest =
      today > utcToday()
        ? today
        : utcToday();

    setFormError("");
    setLeaveType(
      leaveTypes[0].name,
    );
    setFrom(earliest);
    setTo(earliest);
    setReason("");
    setDialog("leave");
  }

  // ===================================================
  // OPEN CANCELLATION
  // ===================================================

  function openCancelLeave(
    id: string,
  ) {
    if (
      leaveBusy.current ||
      leaveSaving
    ) {
      return;
    }

    const request =
      leaveRequests.find(
        (entry) =>
          entry.id === id,
      );

    if (
      !request ||
      !canCancelLeaveRequest(request)
    ) {
      setMessage(
        "Only pending leave or approved leave that has not started can be cancelled.",
      );
      return;
    }

    setCancelLeaveId(id);
    setDialog("cancelLeave");
  }

  // ===================================================
  // CONFIRM CANCELLATION
  // ===================================================

  async function confirmCancelLeave() {
    if (
      leaveBusy.current ||
      !cancelLeaveId
    ) {
      return;
    }

    const request =
      leaveRequests.find(
        (entry) =>
          entry.id === cancelLeaveId,
      );

    if (
      !request ||
      !canCancelLeaveRequest(request)
    ) {
      setMessage(
        "This request is no longer eligible for cancellation.",
      );

      setDialog(null);
      setCancelLeaveId(null);
      return;
    }

    leaveBusy.current = true;
    setLeaveSaving(true);

    try {
      const updated =
        await leaveApi.cancel(
          request.id,
        );

      setLeaveRequests(
        (current) =>
          current.map(
            (item) =>
              item.id === updated.id
                ? updated
                : item,
          ),
      );

      setDialog(null);
      setCancelLeaveId(null);

      setMessage(
        "Leave request cancelled successfully.", 'success',
      );

      refreshLeave();
    } catch (error) {
      setMessage(
        apiError(
          error,
          "Unable to cancel leave request.",
        ), 'error',
      );

      // Refresh after a failed response because
      // the server may have saved the change.
      refreshLeave();
    } finally {
      leaveBusy.current = false;
      setLeaveSaving(false);
    }
  }

  // ===================================================
  // APPLY FOR LEAVE
  // ===================================================

  async function submitLeave() {
    if (
      leaveBusy.current
    ) {
      return;
    }

    if (
      !employeeCompanyId ||
      !employeeBranchId
    ) {
      setFormError(
        "A valid employee company and branch are required.",
      );
      return;
    }

    if (
      leaveLoading ||
      leaveError
    ) {
      setFormError(
        leaveError ||
        "Leave information is still loading.",
      );
      return;
    }

    const selected =
      leaveTypes.find(
        (item) =>
          item.name === leaveType,
      );

    if (!selected) {
      setFormError(
        "Please select a valid leave type.",
      );
      return;
    }

    if (
      !validDate(from) ||
      !validDate(to)
    ) {
      setFormError(
        "Enter valid dates in YYYY-MM-DD format.",
      );
      return;
    }

    if (
      from < utcToday() ||
      to < from
    ) {
      setFormError(
        "Choose dates from today onwards.",
      );
      return;
    }

    if (
      from.slice(0, 4) !==
      to.slice(0, 4)
    ) {
      setFormError(
        "Split cross-year leave into separate requests.",
      );
      return;
    }

    const requestedDays =
      leaveDays(from, to);

    if (
      !Number.isFinite(
        requestedDays,
      ) ||
      requestedDays < 1 ||
      requestedDays > 366
    ) {
      setFormError(
        "Invalid leave duration.",
      );
      return;
    }

    // The backend checks available paid-leave
    // allocation at approval time.
    // Pending requests do not deduct usedDays.

    const overlapping =
      leaveRequests.some(
        (request) =>
          (
            request.status ===
            "PENDING" ||
            request.status ===
            "APPROVED"
          ) &&
          from <=
          dateOnly(
            request.endDate,
          ) &&
          to >=
          dateOnly(
            request.startDate,
          ),
      );

    if (overlapping) {
      setFormError(
        "An existing leave request overlaps these dates.",
      );
      return;
    }

    if (!reason.trim() || reason.trim().length > 2000) {
      setFormError(
        "Enter a leave reason of up to 2000 characters.",
      );
      return;
    }

    leaveBusy.current = true;
    setLeaveSaving(true);
    setFormError("");

    try {
      const created =
        await leaveApi.apply({
          companyId:
            employeeCompanyId,
          branchId:
            employeeBranchId,
          leaveTypeId:
            selected.id,
          startDate: from,
          endDate: to,
          reason:
            reason.trim(),
        });

      setLeaveRequests(
        (current) => [
          created,
          ...current.filter(
            (request) =>
              request.id !==
              created.id,
          ),
        ],
      );

      setDialog(null);

      setMessage(
        "Leave request submitted successfully.", 'success',
      );

      refreshLeave();
    } catch (error) {
      setFormError(
        apiError(
          error,
          "Unable to submit leave request.",
        ),
      );
    } finally {
      leaveBusy.current = false;
      setLeaveSaving(false);
    }
  }

  // ===================================================
  // REFRESH THE LOCAL CALENDAR DATE
  // ===================================================

  useEffect(() => {
    const timer = setInterval(() => setToday(dayKey()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!message) {
      return;
    }

    const timer =
      setTimeout(() => {
        setMessage("");
      }, 4000);

    return () =>
      clearTimeout(timer);
  }, [message]);

  // ===================================================
  // NAVIGATION
  // ===================================================

  function go(next: Page) {
    router.replace(
      employeeRoutes[next],
    );

    setDialog(null);
    setQuery("");
    setFilter("All");

    scroll.current?.scrollTo({
      y: 0,
      animated: false,
    });
  }

  useEffect(() => {
    const subscription =
      BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          if (signedOut) {
            return false;
          }

          if (dialog) {
            setDialog(null);
            return true;
          }

          if (
            page !== "home"
          ) {
            go(
              [
                "documents",
                "advances",
                "help",
              ].includes(page)
                ? "profile"
                : "home",
            );

            return true;
          }

          return false;
        },
      );

    return () =>
      subscription.remove();
  }, [
    page,
    dialog,
    signedOut,
  ]);

  // ===================================================
  // TASKS
  // ===================================================

  const outstanding =
    records.tasks
      .filter(
        (task) =>
          task.status !==
          "Completed",
      )
      .sort((a, b) =>
        (
          a.date + a.time
        ).localeCompare(
          b.date + b.time,
        ),
      );

  // ===================================================
  // SIGN OUT
  // ===================================================

  async function signOutEmployee() {
    try {
      await signOut();

      setSignedOut(true);

      router.replace(
        "/auth/login",
      );
    } catch {
      setMessage(
        "Unable to sign out. Please try again.", 'error',
      );
    }
  }

  useEffect(() => {
    setDialog(null);
    setQuery("");
    setFilter("All");

    scroll.current?.scrollTo({
      y: 0,
      animated: false,
    });
  }, [page]);

  // ===================================================
  // EXPOSE WORKSPACE STATE
  // ===================================================

  return {
    width,
    compact,
    tablet,
    desktop,
    splitLayout,
    page,

    signedOut,
    setSignedOut,

    employeeName,
    employeeEmail,
    employeeId,
    employeeBranch,
    employeeDepartment,
    employeeManager,
    employeePhone,
    employeeDesignation,
    employeeCompany,
    employeeCompanyId,
    employeeBranchId,

    employeeProfile,
    employeeProfiles,
    assignedProfiles,
    selectedProfileId,
    setSelectedProfileId,
    refreshProfile,
    profileLoading,
    profileError,

    signOutEmployee,

    leaveTypes,
    leaveRequests,
    leaveBalances,
    leaveLoading,
    leaveSaving,
    leaveError,
    refreshLeave,

    payslips,
    payslipsLoading,
    payslipsError,

    advanceAmount,
    setAdvanceAmount,
    advanceReason,
    setAdvanceReason,
    advanceError,
    setAdvanceError,

    records,
    setRecords,
    loaded,
    message,
    setMessage,
    storageError,

    dialog,
    setDialog,

    activeDocument,
    setActiveDocument,
    savingDocument,
    setSavingDocument,

    activeTask,
    setActiveTask,
    taskStatus,
    setTaskStatus,
    taskNote,
    setTaskNote,

    filter,
    setFilter,
    query,
    setQuery,

    leaveType,
    setLeaveType,
    from,
    setFrom,
    to,
    setTo,
    reason,
    setReason,
    formError,
    setFormError,

    today,
    scroll,
    blurTarget,
    go,

    leaveBalance,
    pendingLeaveDays,
    canCancelLeaveRequest,
    openLeave,
    openCancelLeave,
    confirmCancelLeave,
    submitLeave,

    shift,
    outstanding,
    attendanceShifts,
    attendanceHistory,
    attendanceLoading,
    attendanceSaving,
    attendanceError,
    refreshAttendance,
    checkAttendance,
  };
}

// =====================================================
// PROVIDER
// =====================================================

const EmployeeWorkspaceContext =
  createContext<
    ReturnType<
      typeof useWorkspaceState
    > | null
  >(null);

export function EmployeeWorkspaceProvider({
  children,
}: {
  children: ReactNode;
}) {
  const workspace =
    useWorkspaceState();

  return (
    <EmployeeWorkspaceContext.Provider
      value={workspace}
    >
      {children}
    </EmployeeWorkspaceContext.Provider>
  );
}

export function useEmployeeWorkspace() {
  const workspace =
    useContext(
      EmployeeWorkspaceContext,
    );

  if (!workspace) {
    throw new Error(
      "Employee screens must be rendered within EmployeeWorkspaceProvider.",
    );
  }

  return workspace;
}
