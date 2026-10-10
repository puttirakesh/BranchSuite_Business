import { BackHandler, ScrollView, View, useWindowDimensions } from 'react-native';
import { Page, Task, EmployeeDocument, Records, STORAGE_KEY, dayKey, validDate, leaveDays, initialRecords, validRecords } from './data';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname, useRouter, type Href } from 'expo-router';

const employeeRoutes = {
  home: '/employee/dashboard',
  attendance: '/employee/attendance',
  leave: '/employee/leave',
  tasks: '/employee/tasks',
  payroll: '/employee/payslips',
  profile: '/employee/profile',
  documents: '/employee/documents',
  advances: '/employee/advances',
  help: '/employee/help',
} as const satisfies Record<Page, Href>;

function pageForPath(pathname: string): Page {
  return (Object.keys(employeeRoutes) as Page[]).find(
    (page) => employeeRoutes[page] === pathname.replace(/\/$/, ''),
  ) ?? 'home';
}

function useWorkspaceState() {
  const { width } = useWindowDimensions();
  const compact = width < 640;
  const tablet = width >= 768;
  const desktop = width >= 1024;
  const splitLayout = tablet || desktop;
  const router = useRouter();
  const pathname = usePathname();
  const page: Page = pageForPath(pathname);
  const [signedOut, setSignedOut] = useState(false);
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [advanceReason, setAdvanceReason] = useState("");
  const [advanceError, setAdvanceError] = useState("");
  const [records, setRecords] = useState<Records>(initialRecords);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState("");
  const [storageError, setStorageError] = useState(false);
  const [dialog, setDialog] = useState<
    "leave" | "payslip" | "task" | "search" | "document" | "cancelLeave" | null
  >(null);
  const [cancelLeaveId, setCancelLeaveId] = useState<string | null>(null);
  const [activeDocument, setActiveDocument] = useState<EmployeeDocument | null>(null);
  const [savingDocument, setSavingDocument] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [taskStatus, setTaskStatus] = useState<Task["status"]>("Open");
  const [taskNote, setTaskNote] = useState("");
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [leaveType, setLeaveType] = useState("Casual leave");
  const [from, setFrom] = useState(dayKey());
  const [to, setTo] = useState(dayKey());
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState("");
  const [today, setToday] = useState(dayKey());
  const scroll = useRef<ScrollView>(null);
  const blurTarget = useRef<View>(null);
  const saveQueue = useRef(Promise.resolve());
  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw && mounted) {
          const saved: unknown = JSON.parse(raw);
          if (validRecords(saved)) setRecords(saved);
          else setStorageError(true);
        }
      })
      .catch(() => {
        if (mounted) setStorageError(true);
      })
      .finally(() => {
        if (mounted) setLoaded(true);
      });
    const timer = setInterval(() => setToday(dayKey()), 30000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    if (!loaded) return;
    saveQueue.current = saveQueue.current
      .then(() => AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(records)))
      .catch(() => {
        setStorageError(true);
      });
  }, [records, loaded]);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 4000);
    return () => clearTimeout(timer);
  }, [message]);
  function go(next: Page) {
    router.replace(employeeRoutes[next]);
    setDialog(null);
    setQuery("");
    setFilter("All");
    scroll.current?.scrollTo({ y: 0, animated: false });
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
          go(["documents", "advances", "help"].includes(page) ? "profile" : "home");
          return true;
        }
        return false;
      },
    );
    return () => subscription.remove();
  }, [page, dialog, signedOut]);
  function leaveBalance(type: string) {
    const reserved = records.leaves
      .filter(
        (l) => l.type === type && ["Pending", "Approved"].includes(l.status),
      )
      .reduce((total, l) => total + leaveDays(l.from, l.to), 0);
    return Math.max(0, (type === "Casual leave" ? 6 : 4) - reserved);
  }
  function openLeave() {
    setFormError("");
    setFrom(today);
    setTo(today);
    setReason("");
    setDialog("leave");
  }
  function openCancelLeave(id: string) {
    setCancelLeaveId(id);
    setDialog('cancelLeave');
  }
  function confirmCancelLeave() {
    const request = records.leaves.find((leave) => leave.id === cancelLeaveId);
    setDialog(null);
    setCancelLeaveId(null);
    if (!request || request.status !== 'Pending') {
      setMessage('This request is no longer pending.');
      return;
    }
    setRecords((current) => ({
      ...current,
      leaves: current.leaves.map((leave) => leave.id === request.id && leave.status === 'Pending' ? { ...leave, status: 'Cancelled' } : leave),
    }));
    setMessage('Leave request cancelled. Your available balance has been restored.');
  }
  const shift = records.shifts.find((item) => item.date === today);
  const outstanding = records.tasks
    .filter((t) => t.status !== "Completed")
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  function checkAttendance() {
    const now = new Date();
    const currentDay = dayKey(now);
    const time = now.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const current = records.shifts.find((item) => item.date === currentDay);
    if (current?.outTime) return;
    setToday(currentDay);
    setRecords((r) => {
      const savedShift = r.shifts.find((item) => item.date === currentDay);
      if (savedShift?.outTime || (current ? !savedShift : !!savedShift))
        return r;
      return {
        ...r,
        shifts: savedShift
          ? r.shifts.map((item) =>
              item.date === currentDay ? { ...item, outTime: time } : item,
            )
          : [{ date: currentDay, inTime: time, outTime: "" }, ...r.shifts],
      };
    });
    setMessage(
      current ? "Check out recorded." : "Check in recorded. Have a good day!",
    );
  }
  function submitLeave() {
    if (!validDate(from) || !validDate(to)) {
      setFormError("Enter valid dates in YYYY-MM-DD format.");
      return;
    }
    if (from < today || to < from) {
      setFormError(
        "Choose dates from today onwards, with the end after the start.",
      );
      return;
    }
    const days = leaveDays(from, to);
    if (days > leaveBalance(leaveType)) {
      setFormError(
        "This request exceeds your available leave balance, including pending requests.",
      );
      return;
    }
    if (
      records.leaves.some(
        (l) => l.status === "Pending" && from <= l.to && to >= l.from,
      )
    ) {
      setFormError("You already have a request for overlapping dates.");
      return;
    }
    if (!reason.trim()) {
      setFormError("Add a reason for your leave request.");
      return;
    }
    setRecords((r) => ({
      ...r,
      leaves: [
        {
          id: String(Date.now()),
          type: leaveType,
          from,
          to,
          reason: reason.trim(),
          status: "Pending",
        },
        ...r.leaves,
      ],
    }));
    setDialog(null);
    setMessage("Leave request saved in this demo.");
  }
  useEffect(() => {
    setDialog(null);
    setQuery("");
    setFilter("All");
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [page]);

  return {
    width, compact, desktop, splitLayout, page, signedOut, setSignedOut,
    advanceAmount, setAdvanceAmount, advanceReason, setAdvanceReason,
    advanceError, setAdvanceError, records, setRecords, loaded,
    message, setMessage, storageError, dialog, setDialog,
    activeDocument, setActiveDocument, savingDocument, setSavingDocument,
    activeTask, setActiveTask, taskStatus, setTaskStatus, taskNote, setTaskNote,
    filter, setFilter, query, setQuery, leaveType, setLeaveType,
    from, setFrom, to, setTo, reason, setReason, formError, setFormError,
    today, scroll, blurTarget, go, leaveBalance, openLeave, shift, outstanding,
    checkAttendance, submitLeave, openCancelLeave, confirmCancelLeave,
  };
}

const EmployeeWorkspaceContext = createContext<ReturnType<typeof useWorkspaceState> | null>(null);

export function EmployeeWorkspaceProvider({ children }: { children: ReactNode }) {
  const workspace = useWorkspaceState();
  return <EmployeeWorkspaceContext.Provider value={workspace}>{children}</EmployeeWorkspaceContext.Provider>;
}

export function useEmployeeWorkspace() {
  const workspace = useContext(EmployeeWorkspaceContext);
  if (!workspace) throw new Error('Employee screens must be rendered within EmployeeWorkspaceProvider.');
  return workspace;
}
