
import {
  BackHandler,
  ScrollView,
  View,
  useWindowDimensions,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";

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
  STORAGE_KEY,
  dayKey,
  validDate,
  leaveDays,
  initialRecords,
  validRecords,
} from "./data";

import { useAuth } from "../../core/auth/AuthProvider";

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
} from "../../core/admin/api";

// =====================================================
// EMPLOYEE ROUTES
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
        employeeRoutes[page] === pathname.replace(/\/$/, ""),
    ) ?? "home"
  );
}

function formatAttendanceTime(value: string | null): string {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function apiError(error: unknown, fallback: string): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error
  ) {
    const response = (
      error as {
        response?: {
          status?: number;
          data?: { message?: string | string[] };
        };
      }
    ).response;

    const message = response?.data?.message;

    if (Array.isArray(message)) return message.join(", ");

    if (typeof message === "string") return message;

    if (response?.status === 401) {
      return "Session expired. Please sign in again.";
    }

    if (response?.status === 403) {
      return "You do not have permission to access this information.";
    }
  }

  return error instanceof Error ? error.message : fallback;
}

function dateOnly(value: string): string {
  return value.slice(0, 10);
}

function numberOfDaysInYear(
  request: LeaveRequestDto,
  year: number,
): number {
  const first = `${year}-01-01`;
  const last = `${year}-12-31`;

  const from = dateOnly(request.startDate);
  const to = dateOnly(request.endDate);

  if (to < first || from > last) return 0;

  const clippedFrom = from < first ? first : from;
  const clippedTo = to > last ? last : to;

  // The backend's "days" field remains authoritative
  // for requests that fall entirely within the year.
  if (clippedFrom === from && clippedTo === to) {
    return Number(request.days) || 0;
  }

  // Cross-year estimate, using the calendar-day utility.
  return leaveDays(clippedFrom, clippedTo);
}

// =====================================================
// WORKSPACE
// =====================================================

function useWorkspaceState() {
  const { width } = useWindowDimensions();

  const compact = width < 640;
  const tablet = width >= 768;
  const desktop = width >= 1024;
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

  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] =
    useState<string | null>(null);

  const assignedProfiles = employeeProfiles.filter((profile) =>
    session?.memberships?.some(
      (membership) =>
        membership.companyId === profile.companyId &&
        membership.branches.some(
          (branch) => branch.id === profile.branchId,
        ),
    ),
  );

  // Preserve the original multi-profile safety rule.
  const employeeProfile =
    assignedProfiles.length === 1 ? assignedProfiles[0] : null;

  const employeeName =
    employeeProfile?.user?.name ??
    session?.user?.name ??
    "Employee";

  const employeeEmail =
    employeeProfile?.workEmail ??
    employeeProfile?.user?.email ??
    session?.user?.email ??
    "";

  const employeeId = employeeProfile?.employeeCode ?? "";
  const employeeBranch =
    employeeProfile?.branch?.name ?? "Not assigned";

  const employeeDepartment =
    employeeProfile?.department ?? "Not assigned";

  const employeePhone =
    employeeProfile?.user?.phone ?? "Not available";

  const employeeDesignation =
    employeeProfile?.designation ?? "Not assigned";

  const employeeCompany =
    employeeProfile?.company?.name ?? "Not assigned";

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
        const profiles = await getEmployeeProfiles();

        if (cancelled) return;

        if (!Array.isArray(profiles)) {
          throw new Error("Invalid employee profile response.");
        }

        setEmployeeProfiles(profiles);
      } catch (error) {
        if (!cancelled) {
          console.error("Employee profile API:", error);

          setProfileError(
            "Unable to load employee details. Check your backend connection.",
          );
        }
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    }

    void loadEmployeeProfile();

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  // ===================================================
  // EXISTING SHARED WORKSPACE STATE
  // ===================================================

  const [signedOut, setSignedOut] = useState(false);

  const [advanceAmount, setAdvanceAmount] = useState("");
  const [advanceReason, setAdvanceReason] = useState("");
  const [advanceError, setAdvanceError] = useState("");

  const [records, setRecords] =
    useState<Records>(initialRecords);

  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState("");
  const [storageError, setStorageError] = useState(false);

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

  const [taskNote, setTaskNote] = useState("");

  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");

  const [leaveType, setLeaveType] =
    useState("Casual leave");

  const [from, setFrom] = useState(dayKey());
  const [to, setTo] = useState(dayKey());
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState("");

  const [today, setToday] = useState(dayKey());

  // Payroll integration is separate.
  const [payslips] = useState<PayslipItem[]>([]);

  const scroll = useRef<ScrollView>(null);
  const blurTarget = useRef<View>(null);
  const saveQueue = useRef(Promise.resolve());

  // ===================================================
  // SCOPE
  // ===================================================

  const employeeUserId = session?.user?.id;
  const employeeCompanyId = employeeProfile?.companyId;
  const employeeBranchId = employeeProfile?.branchId;

  // ===================================================
  // REAL ATTENDANCE STATE
  // ===================================================

  const [attendanceHistory, setAttendanceHistory] =
    useState<AttendanceDto[]>([]);

  const [attendanceLoading, setAttendanceLoading] =
    useState(false);

  const [attendanceSaving, setAttendanceSaving] =
    useState(false);

  const [attendanceError, setAttendanceError] =
    useState("");

  const attendanceBusy = useRef(false);

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
          const history = await attendanceApi.mine();

          if (!active) return;

          if (!Array.isArray(history)) {
            throw new Error("Invalid attendance API response.");
          }

          setAttendanceHistory(
            history.filter(
              (entry) =>
                entry.companyId === employeeCompanyId &&
                entry.branchId === employeeBranchId &&
                entry.userId === employeeUserId,
            ),
          );
        } catch (error) {
          if (active) {
            setAttendanceError(
              apiError(error, "Unable to load attendance."),
            );
            setAttendanceHistory([]);
          }
        } finally {
          if (active) setAttendanceLoading(false);
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
    ]),
  );

  const attendanceShifts: AttendanceShift[] =
    attendanceHistory.map((entry) => ({
      id: entry.id,
      date: dateOnly(entry.attendanceDate),
      inTime: formatAttendanceTime(entry.checkInAt),
      outTime: formatAttendanceTime(entry.checkOutAt),
      status: entry.status,
    }));

  const shift =
    attendanceShifts.find((item) => item.date === today) ??
    null;

  async function checkAttendance() {
    if (attendanceBusy.current) return;

    if (!employeeCompanyId || !employeeBranchId) {
      setMessage(
        "A valid company and branch assignment is required.",
      );
      return;
    }

    if (
      attendanceLoading ||
      attendanceSaving ||
      attendanceError
    ) {
      setMessage(
        "Attendance is not ready. Reopen this screen and try again.",
      );
      return;
    }

    if (shift?.outTime) {
      go("attendance");
      return;
    }

    attendanceBusy.current = true;
    setAttendanceSaving(true);

    const checkingOut = !!shift?.inTime;

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

      setAttendanceHistory((current) => {
        const exists = current.some(
          (entry) => entry.id === result.id,
        );

        return exists
          ? current.map((entry) =>
              entry.id === result.id ? result : entry,
            )
          : [result, ...current];
      });

      setMessage(
        checkingOut
          ? "Check out recorded successfully."
          : "Check in recorded successfully.",
      );
    } catch (error) {
      setMessage(
        apiError(error, "Unable to record attendance."),
      );
    } finally {
      attendanceBusy.current = false;
      setAttendanceSaving(false);
    }
  }

  // ===================================================
  // REAL LEAVE MANAGEMENT STATE
  // ===================================================

  const [leaveTypes, setLeaveTypes] =
    useState<LeaveTypeOption[]>([]);

  const [leaveRequests, setLeaveRequests] =
    useState<LeaveRequestDto[]>([]);

  const [leaveLoading, setLeaveLoading] = useState(false);
  const [leaveSaving, setLeaveSaving] = useState(false);
  const [leaveError, setLeaveError] = useState("");
  const [leaveRefresh, setLeaveRefresh] = useState(0);

  const leaveBusy = useRef(false);

  const refreshLeave = useCallback(() => {
    setLeaveRefresh((current) => current + 1);
  }, []);

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

        const [typesResult, requestsResult] =
          await Promise.allSettled([
            leaveApi.types(employeeCompanyId!),
            leaveApi.requests(employeeCompanyId!),
          ] as const);

        if (!active) return;

        const errors: string[] = [];

        if (typesResult.status === "fulfilled") {
          const types: LeaveTypeDto[] = typesResult.value;

          setLeaveTypes(
            types
              .filter((item) => item.status === "ACTIVE")
              .map((item) => ({
                id: item.id,
                code: item.code,
                name: item.name,
                annualAllowance: Number(
                  item.annualAllowance,
                ),
                isPaid: item.isPaid,
              })),
          );
        } else {
          setLeaveTypes([]);
          errors.push(
            "Leave types: " +
              apiError(
                typesResult.reason,
                "Unable to load leave types.",
              ),
          );
        }

        if (requestsResult.status === "fulfilled") {
          const requests: LeaveRequestDto[] =
            requestsResult.value;

          // Never display another employee's requests.
          setLeaveRequests(
            requests
              .filter(
                (request) =>
                  request.companyId === employeeCompanyId &&
                  request.branchId === employeeBranchId &&
                  request.userId === employeeUserId,
              )
              .sort((a, b) =>
                b.createdAt.localeCompare(a.createdAt),
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

        setLeaveError(errors.join(" "));
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

  // Returns null when the actual balance is unavailable.
  // Avoids displaying invented leave allowances.
  function leaveBalance(typeName: string): number | null {
    const selected = leaveTypes.find(
      (item) => item.name === typeName,
    );

    if (!selected || leaveError) return null;

    const year = Number(today.slice(0, 4));

    const reserved = leaveRequests
      .filter(
        (request) =>
          request.leaveTypeId === selected.id &&
          (request.status === "PENDING" ||
            request.status === "APPROVED"),
      )
      .reduce(
        (total, request) =>
          total + numberOfDaysInYear(request, year),
        0,
      );

    return Math.max(
      0,
      selected.annualAllowance - reserved,
    );
  }

  function openLeave() {
    if (leaveLoading || leaveSaving) {
      setMessage("Leave information is still loading.");
      return;
    }

    if (leaveError || leaveTypes.length === 0) {
      setMessage(
        leaveError ||
          "No active leave types have been configured.",
      );
      return;
    }

    setFormError("");
    setLeaveType(leaveTypes[0].name);
    setFrom(today);
    setTo(today);
    setReason("");
    setDialog("leave");
  }

  function openCancelLeave(id: string) {
    const request = leaveRequests.find(
      (entry) => entry.id === id,
    );

    if (!request || request.status !== "PENDING") {
      setMessage(
        "Only your pending requests can be cancelled.",
      );
      return;
    }

    setCancelLeaveId(id);
    setDialog("cancelLeave");
  }

  async function confirmCancelLeave() {
    if (leaveBusy.current || !cancelLeaveId) return;

    const request = leaveRequests.find(
      (entry) => entry.id === cancelLeaveId,
    );

    if (!request || request.status !== "PENDING") {
      setMessage("This request is no longer pending.");
      setDialog(null);
      setCancelLeaveId(null);
      return;
    }

    leaveBusy.current = true;
    setLeaveSaving(true);

    try {
      const updated = await leaveApi.cancel(request.id);

      setLeaveRequests((current) =>
        current.map((item) =>
          item.id === updated.id ? updated : item,
        ),
      );

      setDialog(null);
      setCancelLeaveId(null);
      setMessage("Leave request cancelled successfully.");

      refreshLeave();
    } catch (error) {
      setMessage(
        apiError(error, "Unable to cancel leave request."),
      );
    } finally {
      leaveBusy.current = false;
      setLeaveSaving(false);
    }
  }

  async function submitLeave() {
    if (leaveBusy.current) return;

    if (!employeeCompanyId || !employeeBranchId) {
      setFormError(
        "A valid employee company and branch are required.",
      );
      return;
    }

    if (leaveLoading || leaveError) {
      setFormError(
        leaveError || "Leave information is still loading.",
      );
      return;
    }

    const selected = leaveTypes.find(
      (item) => item.name === leaveType,
    );

    if (!selected) {
      setFormError("Please select a valid leave type.");
      return;
    }

    if (!validDate(from) || !validDate(to)) {
      setFormError(
        "Enter valid dates in YYYY-MM-DD format.",
      );
      return;
    }

    if (from < today || to < from) {
      setFormError(
        "Choose dates from today onwards.",
      );
      return;
    }

    const requestedDays = leaveDays(from, to);

    const balance = leaveBalance(leaveType);

    if (
      selected.isPaid &&
      balance !== null &&
      requestedDays > balance
    ) {
      setFormError(
        "This request exceeds your estimated leave balance.",
      );
      return;
    }

    const overlapping = leaveRequests.some(
      (request) =>
        ["PENDING", "APPROVED"].includes(request.status) &&
        from <= dateOnly(request.endDate) &&
        to >= dateOnly(request.startDate),
    );

    if (overlapping) {
      setFormError(
        "An existing leave request overlaps these dates.",
      );
      return;
    }

    if (!reason.trim()) {
      setFormError("Please enter a leave reason.");
      return;
    }

    leaveBusy.current = true;
    setLeaveSaving(true);
    setFormError("");

    try {
      const created = await leaveApi.apply({
        companyId: employeeCompanyId,
        branchId: employeeBranchId,
        leaveTypeId: selected.id,
        startDate: from,
        endDate: to,
        reason: reason.trim(),
      });

      setLeaveRequests((current) => [
        created,
        ...current.filter(
          (request) => request.id !== created.id,
        ),
      ]);

      setDialog(null);
      setMessage("Leave request submitted successfully.");

      refreshLeave();
    } catch (error) {
      setFormError(
        apiError(error, "Unable to submit leave request."),
      );
    } finally {
      leaveBusy.current = false;
      setLeaveSaving(false);
    }
  }

  // ===================================================
  // REMAINING LOCAL WORKSPACE DATA
  // ===================================================

  useEffect(() => {
    let mounted = true;

    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw || !mounted) return;

        const saved: unknown = JSON.parse(raw);

        if (validRecords(saved)) {
          setRecords(saved);
        } else {
          setStorageError(true);
        }
      })
      .catch(() => {
        if (mounted) setStorageError(true);
      })
      .finally(() => {
        if (mounted) setLoaded(true);
      });

    const timer = setInterval(() => {
      setToday(dayKey());
    }, 30000);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;

    saveQueue.current = saveQueue.current
      .then(() =>
        AsyncStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(records),
        ),
      )
      .catch(() => {
        setStorageError(true);
      });
  }, [loaded, records]);

  useEffect(() => {
    if (!message) return;

    const timer = setTimeout(() => {
      setMessage("");
    }, 4000);

    return () => clearTimeout(timer);
  }, [message]);

  // ===================================================
  // NAVIGATION
  // ===================================================

  function go(next: Page) {
    router.replace(employeeRoutes[next]);

    setDialog(null);
    setQuery("");
    setFilter("All");

    scroll.current?.scrollTo({
      y: 0,
      animated: false,
    });
  }

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (signedOut) return false;

        if (dialog) {
          setDialog(null);
          return true;
        }

        if (page !== "home") {
          go(
            ["documents", "advances", "help"].includes(page)
              ? "profile"
              : "home",
          );
          return true;
        }

        return false;
      },
    );

    return () => subscription.remove();
  }, [page, dialog, signedOut]);

  // ===================================================
  // EXISTING LOCAL TASK WORKSPACE
  // ===================================================

  const outstanding = records.tasks
    .filter((task) => task.status !== "Completed")
    .sort((a, b) =>
      (a.date + a.time).localeCompare(
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
      router.replace("/auth/login");
    } catch {
      setMessage("Unable to sign out. Please try again.");
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
    employeePhone,
    employeeDesignation,
    employeeCompany,

    employeeProfile,
    employeeProfiles,
    profileLoading,
    profileError,

    signOutEmployee,

    leaveTypes,
    leaveRequests,
    leaveLoading,
    leaveSaving,
    leaveError,
    refreshLeave,
    payslips,

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
    checkAttendance,
  };
}

// =====================================================
// PROVIDER
// =====================================================

const EmployeeWorkspaceContext = createContext<
  ReturnType<typeof useWorkspaceState> | null
>(null);

export function EmployeeWorkspaceProvider({
  children,
}: {
  children: ReactNode;
}) {
  const workspace = useWorkspaceState();

  return (
    <EmployeeWorkspaceContext.Provider value={workspace}>
      {children}
    </EmployeeWorkspaceContext.Provider>
  );
}

export function useEmployeeWorkspace() {
  const workspace = useContext(EmployeeWorkspaceContext);

  if (!workspace) {
    throw new Error(
      "Employee screens must be rendered within EmployeeWorkspaceProvider.",
    );
  }

  return workspace;
}
