import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Page = "home" | "attendance" | "tasks" | "payroll" | "leave" | "profile" | "documents" | "advances" | "help";
type Task = {
  id: string;
  title: string;
  type: string;
  date: string;
  time: string;
  high?: boolean;
  status: "Open" | "In progress" | "Completed";
  note: string;
};
type Shift = { date: string; inTime: string; outTime: string };
type Leave = {
  id: string;
  type: string;
  from: string;
  to: string;
  reason: string;
  status: string;
};
type Advance = { id: string; amount: number; reason: string; date: string; status: "Pending" };
type EmployeeDocument = { id: string; title: string; date: string; kind: "Letter" | "Verification"; status: "Available" | "Verified"; content: string };
type Records = { shifts: Shift[]; tasks: Task[]; leaves: Leave[]; advances?: Advance[]; documents?: EmployeeDocument[] };
const STORAGE_KEY = "branchsuite:employee:EMP0082:v2.3";
const employee = {
  name: "Ananya Rao",
  id: "EMP0082",
  branch: "Vijayawada",
  company: "5 Gen Educon",
  department: "Operations",
  manager: "Kavitha Reddy",
  email: "ananya.rao.82@demo.example",
  phone: "+91 90000 10082",
};
const colors = {
  ink: "#17263F",
  muted: "#5F7088",
  primary: "#11786D",
  background: "#F4F9F7",
  border: "#E0E7F0",
};
function employmentLetter(date: string) {
  return `${employee.company}\nSample employment confirmation\nDate: ${date}\n\nTo whom it may concern,\n\nThis sample letter confirms that ${employee.name} (${employee.id}) is employed in the ${employee.department} department at our ${employee.branch} branch, reporting to ${employee.manager}.\n\nThis document uses fictional sample data and is for demonstration only.\n\n${employee.company}\nHuman Resources`;
}
const sampleDocuments: EmployeeDocument[] = [
  { id: "employment", title: "Employment confirmation", date: "2025-06-02", kind: "Letter", status: "Available", content: employmentLetter("2025-06-02") },
  { id: "bank", title: "Bank verification", date: "2026-09-15", kind: "Verification", status: "Verified", content: `${employee.company}\nSample bank verification\nDate: 2026-09-15\n\nEmployee: ${employee.name}\nEmployee ID: ${employee.id}\n\nBank details are marked verified in this fictional sample workspace. No actual bank account has been verified.\n\nFor demonstration only.` },
];
function documentDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
const navigation: { page: Page; label: string; symbol: string }[] = [
  { page: "home", label: "My work", symbol: "⌂" },
  { page: "attendance", label: "Attendance", symbol: "◷" },
  { page: "tasks", label: "My tasks", symbol: "☑" },
  { page: "payroll", label: "My payroll", symbol: "▤" },
  { page: "leave", label: "Leave & requests", symbol: "♧" },
  { page: "profile", label: "My profile", symbol: "♙" },
];
function dayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const date = new Date(`${value}T12:00:00`);
  return !Number.isNaN(date.getTime()) && dayKey(date) === value;
}
function leaveDays(from: string, to: string) {
  return (
    Math.round(
      (Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) /
        86400000,
    ) + 1
  );
}
function displayDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}
const money = (amount: number) => `₹${amount.toLocaleString("en-IN")}`;
function initialRecords(): Records {
  return {
    shifts: [],
    leaves: [],
    tasks: [
      {
        id: "weekly",
        title: "Prepare your weekly work update",
        type: "Task",
        date: dayKey(),
        time: "16:00",
        status: "Open",
        note: "Add your progress here so your manager knows the next step.",
      },
      {
        id: "customer",
        title: "Confirm customer requirements",
        type: "Call",
        date: dayKey(),
        time: "11:00",
        high: true,
        status: "Open",
        note: "Confirm the requirement and add a short call outcome. Your manager can review your update.",
      },
      {
        id: "onboarding",
        title: "Complete onboarding checklist",
        type: "Task",
        date: dayKey(),
        time: "10:00",
        status: "Completed",
        note: "Sample onboarding completed.",
      },
    ],
  };
}
function validRecords(value: unknown): value is Records {
  if (!value || typeof value !== "object") return false;
  const record = value as Records;
  return (
    (record.documents === undefined ||
      (Array.isArray(record.documents) && record.documents.every(
        (d) => d && typeof d.id === "string" && typeof d.title === "string" && validDate(d.date) &&
          ["Letter", "Verification"].includes(d.kind) && ["Available", "Verified"].includes(d.status) && typeof d.content === "string",
      ))) &&
    (record.advances === undefined ||
      (Array.isArray(record.advances) && record.advances.every(
        (a) => a && typeof a.id === "string" && Number.isFinite(a.amount) && a.amount > 0 &&
          typeof a.reason === "string" && validDate(a.date) && a.status === "Pending",
      ))) &&
    Array.isArray(record.shifts) &&
    record.shifts.every(
      (s) =>
        s &&
        validDate(s.date) &&
        typeof s.inTime === "string" &&
        typeof s.outTime === "string",
    ) &&
    Array.isArray(record.tasks) &&
    record.tasks.every(
      (t) =>
        t &&
        typeof t.id === "string" &&
        typeof t.title === "string" &&
        typeof t.type === "string" &&
        validDate(t.date) &&
        typeof t.time === "string" &&
        typeof t.note === "string" &&
        ["Open", "In progress", "Completed"].includes(t.status),
    ) &&
    Array.isArray(record.leaves) &&
    record.leaves.every(
      (l) =>
        l &&
        typeof l.id === "string" &&
        ["Casual leave", "Sick leave"].includes(l.type) &&
        validDate(l.from) &&
        validDate(l.to) &&
        l.to >= l.from &&
        typeof l.reason === "string" &&
        typeof l.status === "string",
    )
  );
}
function Button({
  label,
  onPress,
  secondary = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        secondary && s.secondary,
        (pressed || disabled) && { opacity: 0.65 },
      ]}
    >
      <Text style={[s.buttonText, secondary && { color: colors.primary }]}>
        {label}
      </Text>
    </Pressable>
  );
}
function Badge({ label }: { label: string }) {
  const green = ["Paid", "Completed", "Checked in", "Shift complete"].includes(
    label,
  );
  return (
    <View style={[s.badge, { backgroundColor: green ? "#E2F4EC" : "#FFF1DA" }]}>
      <Text style={[s.badgeText, { color: green ? "#217663" : "#945F16" }]}>
        {label}
      </Text>
    </View>
  );
}
// Draw the APK's outline icons with native views so the preview needs no extra packages.
function WorkspaceIcon({ symbol, color = colors.primary, size = 24 }: { symbol: string; color?: string; size?: number }) {
  const stroke = { borderColor: color, borderWidth: 1.7 };
  const line = (left: number, top: number, width: number, rotation = 0) => (
    <View style={{ position: "absolute", left, top, width, height: 1.7, backgroundColor: color, transform: [{ rotate: `${rotation}deg` }] }} />
  );
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <View style={{ width: 24, height: 24, transform: [{ scale: size / 24 }] }}>
        {symbol === "◷" ? <>
          <View style={[stroke, { position: "absolute", left: 3, top: 3, width: 18, height: 18, borderRadius: 10 }]} />
          {line(11, 8, 6, 90)}{line(12, 13, 5, 25)}
        </> : symbol === "♙" ? <>
          <View style={[stroke, { position: "absolute", left: 8, top: 3, width: 8, height: 8, borderRadius: 5 }]} />
          <View style={[stroke, { position: "absolute", left: 4, top: 14, width: 16, height: 8, borderTopLeftRadius: 9, borderTopRightRadius: 9 }]} />
        </> : symbol === "⌂" ? <>
          {line(2, 7, 12, -40)}{line(10, 7, 12, 40)}
          <View style={[stroke, { position: "absolute", left: 5, top: 10, width: 14, height: 11, borderTopWidth: 0, borderRadius: 2 }]} />
          <View style={[stroke, { position: "absolute", left: 10, top: 14, width: 5, height: 7, borderBottomWidth: 0 }]} />
        </> : symbol === "⌕" ? <>
          <View style={[stroke, { position: "absolute", left: 3, top: 3, width: 13, height: 13, borderRadius: 8 }]} />
          {line(14, 17, 8, 45)}
        </> : symbol === "document" ? <>
          <View style={[stroke, { position: "absolute", left: 6, top: 3, width: 13, height: 18, borderRadius: 2 }]} />
          {line(13, 6, 5, 45)}{line(9, 12, 7)}{line(9, 16, 7)}
        </> : symbol === "help" ? <>
          <View style={[stroke, { position: "absolute", left: 4, top: 3, width: 16, height: 16, borderRadius: 9, borderBottomWidth: 0 }]} />
          <View style={[stroke, { position: "absolute", left: 3, top: 12, width: 5, height: 8, borderRadius: 2, backgroundColor: "#FFF1DA" }]} />
          <View style={[stroke, { position: "absolute", left: 16, top: 12, width: 5, height: 8, borderRadius: 2, backgroundColor: "#FFF1DA" }]} />
          {line(12, 21, 6)}
        </> : symbol === "›" ? <>{line(9, 8, 8, 45)}{line(9, 14, 8, -45)}</> : symbol === "♧" ? <>
          <View style={[stroke, { position: "absolute", left: 3, top: 5, width: 18, height: 16, borderRadius: 3 }]} />
          {line(3, 10, 18)}{line(5, 4, 5, 90)}{line(14, 4, 5, 90)}{line(8, 16, 3, 40)}{line(10, 15, 6, -45)}
        </> : symbol === "☑" ? <>
          <View style={[stroke, { position: "absolute", left: 4, top: 3, width: 16, height: 18, borderRadius: 3 }]} />
          {line(7, 12, 4, 40)}{line(9, 11, 7, -45)}{line(8, 17, 8)}
        </> : <>
          <View style={[stroke, { position: "absolute", left: 3, top: 5, width: 18, height: 15, borderRadius: 3 }]} />
          <View style={[stroke, { position: "absolute", left: 14, top: 10, width: 8, height: 6, borderRadius: 2, backgroundColor: "white" }]} />
          {line(16, 12, 2)}
        </>}
      </View>
    </View>
  );
}
function Icon({
  symbol,
  lavender = false,
  amber = false,
}: {
  symbol: string;
  lavender?: boolean;
  amber?: boolean;
}) {
  return (
    <View style={[s.icon, lavender && { backgroundColor: "#EFE8FB" }, amber && { backgroundColor: "#FFF1DA" }]}>
      <WorkspaceIcon symbol={symbol} color={amber ? "#945F16" : lavender ? "#8056B9" : colors.primary} />
    </View>
  );
}
function Tile({
  title,
  description,
  symbol,
  onPress,
  lavender = false,
  amber = false,
}: {
  title: string;
  description: string;
  symbol: string;
  onPress: () => void;
  lavender?: boolean;
  amber?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        s.tile,
        pressed && { backgroundColor: "#F5FBF9" },
      ]}
    >
      <Icon symbol={symbol} lavender={lavender} amber={amber} />
      <View style={s.flex}>
        <Text style={s.cardTitle}>{title}</Text>
        <Text style={s.small}>{description}</Text>
      </View>
      <WorkspaceIcon symbol="›" color="#9AA6B8" size={18} />
    </Pressable>
  );
}
function Field({
  label,
  value,
  onChange,
  multiline = false,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  placeholder?: string;
}) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        placeholder={placeholder}
        placeholderTextColor="#819083"
        style={[
          s.input,
          multiline && { minHeight: 100, textAlignVertical: "top" },
        ]}
      />
    </View>
  );
}

export default function EmployeeDashboard({ initialPage = "home" }: { initialPage?: Page }) {
  const { width } = useWindowDimensions();
  const compact = width < 640;
  const tablet = width >= 768;
  const desktop = width >= 1024;
  const splitLayout = tablet || desktop;
  const [page, setPage] = useState<Page>(initialPage);
  const [signedOut, setSignedOut] = useState(false);
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [advanceReason, setAdvanceReason] = useState("");
  const [advanceError, setAdvanceError] = useState("");
  const [records, setRecords] = useState<Records>(initialRecords);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState("");
  const [storageError, setStorageError] = useState(false);
  const [dialog, setDialog] = useState<
    "leave" | "payslip" | "task" | "search" | "document" | null
  >(null);
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
    setPage(next);
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
  function taskCard(task: Task) {
    return (
      <Pressable
        key={task.id}
        accessibilityRole="button"
        onPress={() => {
          setActiveTask(task);
          setTaskStatus(task.status);
          setTaskNote(task.note);
          setFormError("");
          setDialog("task");
        }}
        style={({ pressed }) => [
          s.card,
          s.taskCard,
          pressed && { borderColor: "#91BCAE" },
        ]}
      >
        <View style={s.between}>
          <Text style={[s.small, task.high && { color: "#AA6B13" }]}>
            {task.type === "Call" ? "♧" : "☑"} {task.type}
            {task.high ? " · High priority" : ""}
          </Text>
          <Badge label={task.status} />
        </View>
        <Text style={[s.cardTitle, { marginTop: 14, marginBottom: 7 }]}>
          {task.title}
        </Text>
        <Text style={s.small}>
          {displayDate(task.date)} · {task.time}
        </Text>
      </Pressable>
    );
  }
  function attendanceCard() {
    return (
      <View style={[s.card, s.shiftCard]}>
        <View style={[s.between, { flexWrap: "wrap", gap: 10 }]}>
          <View style={s.row}>
            <Icon symbol="◷" />
            <Text style={s.cardTitle}>Today’s attendance</Text>
          </View>
          <Badge
            label={
              shift?.outTime
                ? "Shift complete"
                : shift?.inTime
                  ? "Checked in"
                  : "Not checked in"
            }
          />
        </View>
        <Text style={[s.small, { marginTop: 12 }]}>
          {employee.branch} · 09:00–18:00 shift
        </Text>
        <View style={s.times}>
          <View style={s.flex}>
            <Text style={s.small}>Check in</Text>
            <Text style={s.time}>{shift?.inTime || "—"}</Text>
          </View>
          <View style={s.timeLine} />
          <View style={s.flex}>
            <Text style={s.small}>Check out</Text>
            <Text style={s.time}>{shift?.outTime || "—"}</Text>
          </View>
        </View>
        <Button
          disabled={!loaded}
          label={
            shift?.outTime
              ? "View attendance"
              : shift?.inTime
                ? "Check out"
                : "Check in"
          }
          onPress={shift?.outTime ? () => go("attendance") : checkAttendance}
        />
        <Text style={s.localHint}>Sample shift · saved on this device</Text>
      </View>
    );
  }
  const title = {
    home: "My work",
    attendance: "My attendance",
    tasks: "My tasks",
    payroll: "My payroll",
    leave: "Leave & requests",
    profile: "My profile",
    documents: "My documents",
    advances: "Salary advances",
    help: "Help",
  }[page];
  const subtitles = {
    home: `${new Date(`${today}T12:00:00`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })} · ${employee.branch}`,
    attendance: "Your shifts and leave requests.",
    tasks: "Only work assigned to you. Add progress and completion notes.",
    payroll: "Published payslips for your employee account.",
    leave: "Apply for leave and track your requests.",
    profile: "Your details and self-service options.",
    documents: "Sample documents available on this device.",
    advances: "Request and track salary advances.",
    help: "Using your employee workspace.",
  };
  const activeNavPage = ["documents", "advances", "help"].includes(page) ? "profile" : page;
  const nav = (sidebar: boolean) =>
    navigation.filter((item) => sidebar || item.page !== "leave").map((item) => (
      <Pressable
        key={item.page}
        accessibilityRole="tab"
        accessibilityState={{ selected: activeNavPage === item.page }}
        onPress={() => go(item.page)}
        style={[
          sidebar ? s.sideItem : s.navItem,
          activeNavPage === item.page && (sidebar ? s.sideActive : s.navActive),
        ]}
      >
        <WorkspaceIcon symbol={item.symbol} color={activeNavPage === item.page ? colors.primary : colors.muted} size={sidebar ? 22 : 21} />
        <Text
          style={[
            sidebar ? s.sideLabel : s.navLabel,
            activeNavPage === item.page && { color: colors.primary, fontWeight: "700" },
          ]}
        >
          {item.label}
        </Text>
      </Pressable>
    ));
  if (signedOut) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={[s.content, { flex: 1, justifyContent: "center", gap: 16, maxWidth: 480, width: "100%", alignSelf: "center" }]}>
          <Text style={s.title}>Signed out</Text>
          <Text style={s.body}>Your sample attendance, payslips and assigned tasks are saved on this device.</Text>
          <Button label="Open sample workspace" onPress={() => { go("home"); setSignedOut(false); }} />
        </View>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      <View style={s.shell}>
        {desktop && (
          <View style={s.sidebar}>
            <View style={[s.row, { marginBottom: 35 }]}>
              <View style={s.brandIcon}>
                <WorkspaceIcon symbol="♙" color="white" />
              </View>
              <View>
                <Text style={s.brand}>BranchSuite</Text>
                <Text style={s.small}>Employee</Text>
              </View>
            </View>
            <Text style={s.caption}>MY WORKSPACE</Text>
            {nav(true)}
            <View style={s.sideFooter}>
              <View style={s.row}>
                <View style={s.avatar}>
                  <Text style={s.avatarText}>AR</Text>
                </View>
                <View>
                  <Text style={s.cardTitle}>{employee.name}</Text>
                  <Text style={s.small}>Employee</Text>
                </View>
              </View>
              <Text style={s.localHint}>● Sample data · offline</Text>
            </View>
          </View>
        )}
        <View style={s.flex}>
          <View style={[s.topbar, compact && s.topbarCompact]}>
            <View style={[s.flex, compact && s.topbarMeta]}>
              <Text style={[s.cardTitle, compact && { fontSize: 14 }]}>
                {employee.company}
              </Text>
              <Text style={[s.small, { fontSize: 11 }, compact && { fontSize: 10 }]}>
                {employee.branch} · Employee workspace
              </Text>
            </View>
            <View style={s.topbarActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Find a module"
                onPress={() => {
                  setQuery("");
                  setDialog("search");
                }}
                style={s.searchButton}
              >
                <WorkspaceIcon symbol="⌕" color={colors.ink} size={22} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="My profile"
                onPress={() => go("profile")}
                style={s.avatar}
              >
                <Text style={s.avatarText}>AR</Text>
              </Pressable>
            </View>
          </View>
          <ScrollView
            ref={scroll}
            contentContainerStyle={[
              s.content,
              { maxWidth: 1240, width: "100%", alignSelf: "center" },
              compact ? { paddingHorizontal: 16, paddingTop: 20 } : desktop ? { padding: 32 } : { padding: 24 },
            ]}
            keyboardShouldPersistTaps="handled"
          >
            {["advances", "help"].includes(page) && (
              <Button label="Back to profile" secondary onPress={() => go("profile")} />
            )}
            {page === "documents" ? (
              <View style={[s.row, { alignItems: "flex-start", marginBottom: 20 }]}>
                <Pressable accessibilityRole="button" accessibilityLabel="Back to profile" onPress={() => go("profile")} style={s.documentBack}>
                  <Text style={s.cardTitle}>‹</Text>
                </Pressable>
                <View style={s.flex}>
                  <Text style={[s.caption, { marginBottom: 6 }]}>5 GEN WORKSPACE</Text>
                  <Text accessibilityRole="header" style={s.title}>{title}</Text>
                  <Text style={[s.subtitle, { marginBottom: 0 }]}>{subtitles[page]}</Text>
                </View>
              </View>
            ) : <>
            <Text accessibilityRole="header" style={s.title}>
              {title}
            </Text>
            <Text style={s.subtitle}>{subtitles[page]}</Text>
            </>}
            {storageError && (
              <Text accessibilityRole="alert" style={s.error}>
                Device storage is unavailable or could not be read. Changes may
                only last for this session.
              </Text>
            )}
            {!loaded ? (
              <ActivityIndicator
                color={colors.primary}
                style={{ margin: 40 }}
              />
            ) : (
              <>
                {page === "home" && (
                  <>
                    <View style={s.greeting}>
                      <Text style={s.hello}>Hello, Ananya.</Text>
                      <Text style={s.greetingSubtitle}>
                        One clear place for your day, tasks and pay.
                      </Text>
                    </View>
                    <View style={[s.columns, splitLayout && s.desktopColumns]}>
                      <View style={s.column}>
                        {attendanceCard()}
                        <Tile
                          title="Apply for leave"
                          description={`${leaveBalance("Casual leave")} casual · ${leaveBalance("Sick leave")} sick days`}
                          symbol="♧"
                          onPress={() => go("leave")}
                        />
                        <Tile
                          title="My profile"
                          description="Details & documents"
                          symbol="♙"
                          onPress={() => go("profile")}
                        />
                      </View>
                      <View style={s.column}>
                        <View style={s.metrics}>
                          <Pressable
                            accessibilityRole="button"
                            onPress={() => go("tasks")}
                            style={[s.metric, { backgroundColor: "#EDF3FF" }]}
                          >
                            <Icon symbol="☑" />
                            <Text style={s.metricLabel}>Tasks to do</Text>
                            <Text style={s.metricValue}>
                              {outstanding.length}
                            </Text>
                            <Text style={s.small}>Assigned only to you</Text>
                          </Pressable>
                          <Pressable
                            accessibilityRole="button"
                            onPress={() => go("payroll")}
                            style={[s.metric, { backgroundColor: "#F3EEFC" }]}
                          >
                            <Icon symbol="▤" lavender />
                            <Text style={s.metricLabel}>Latest take-home</Text>
                            <Text
                              numberOfLines={1}
                              adjustsFontSizeToFit
                              minimumFontScale={0.7}
                              style={[
                                s.metricValue,
                                width < 360 && { fontSize: 23 },
                              ]}
                            >
                              {money(42200)}
                            </Text>
                            <Text style={s.small}>September 2026 · Paid</Text>
                          </Pressable>
                        </View>
                        <View style={s.section}>
                          <Text style={s.sectionTitle}>Your next tasks</Text>
                          <Pressable
                            accessibilityRole="button"
                            onPress={() => go("tasks")}
                          >
                            <Text style={s.link}>View all ›</Text>
                          </Pressable>
                        </View>
                        {outstanding.length ? (
                          outstanding.slice(0, 3).map(taskCard)
                        ) : (
                          <View style={s.card}>
                            <Text style={s.cardTitle}>
                              Your tasks are up to date
                            </Text>
                            <Text style={s.small}>
                              Assigned CRM tasks will appear here.
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </>
                )}
                {page === "attendance" && (
                  <View style={[s.columns, splitLayout && s.desktopColumns]}>
                    <View style={s.column}>
                      {attendanceCard()}
                      <Tile
                        title="Apply for leave"
                        description="Apply and track your requests"
                        symbol="♧"
                        onPress={openLeave}
                      />
                      <Text style={s.sectionTitle}>Leave requests</Text>
                      {records.leaves.length ? (
                        records.leaves.map((l) => (
                          <View key={l.id} style={s.card}>
                            <View style={s.between}>
                              <Text style={s.cardTitle}>{l.type}</Text>
                              <Badge label={l.status} />
                            </View>
                            <Text style={s.small}>
                              {displayDate(l.from)} – {displayDate(l.to)}
                            </Text>
                            <Text style={[s.body, { marginTop: 10 }]}>
                              {l.reason}
                            </Text>
                            <Text style={s.localHint}>
                              Saved locally · demo request
                            </Text>
                          </View>
                        ))
                      ) : (
                        <Text style={s.small}>No leave requests yet.</Text>
                      )}
                    </View>
                    <View style={s.column}>
                      <Text style={s.sectionTitle}>Recorded shifts</Text>
                      {records.shifts.length ? (
                        [...records.shifts]
                          .sort((a, b) => b.date.localeCompare(a.date))
                          .map((item) => (
                            <View key={item.date} style={s.card}>
                              <View style={s.between}>
                                <Text style={s.cardTitle}>
                                  {displayDate(item.date)}
                                </Text>
                                <Badge
                                  label={
                                    item.outTime
                                      ? "Shift complete"
                                      : "Checked in"
                                  }
                                />
                              </View>
                              <Text style={[s.small, { marginTop: 12 }]}>
                                In {item.inTime} Out {item.outTime || "—"}
                              </Text>
                            </View>
                          ))
                      ) : (
                        <View style={s.card}>
                          <Text style={s.cardTitle}>
                            No attendance recorded
                          </Text>
                          <Text style={s.small}>
                            Check in to record your first demo shift.
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}
                {page === "leave" && (
                  <View style={[s.columns, splitLayout && s.desktopColumns]}>
                    <View style={s.column}>
                      <View style={s.card}>
                        <Text style={s.sectionTitle}>Your leave balance</Text>
                        <View style={s.times}>
                          <View style={s.flex}>
                            <Text style={s.small}>Casual leave</Text>
                            <Text style={s.time}>{leaveBalance("Casual leave")} days</Text>
                          </View>
                          <View style={s.timeLine} />
                          <View style={s.flex}>
                            <Text style={s.small}>Sick leave</Text>
                            <Text style={s.time}>{leaveBalance("Sick leave")} days</Text>
                          </View>
                        </View>
                        <Button label="Apply for leave" onPress={openLeave} disabled={!loaded} />
                      </View>
                      <Text style={s.small}>Pending and approved requests reserve days from your balance.</Text>
                    </View>
                    <View style={s.column}>
                      <Text style={s.sectionTitle}>Your requests</Text>
                      {records.leaves.length ? [...records.leaves].reverse().map((request) => (
                        <View style={s.card} key={request.id}>
                          <View style={s.between}>
                            <Text style={s.cardTitle}>{request.type}</Text>
                            <Badge label={request.status} />
                          </View>
                          <Text style={[s.small, { marginTop: 12 }]}>{displayDate(request.from)} – {displayDate(request.to)}</Text>
                          <Text style={[s.body, { marginTop: 10 }]}>{request.reason}</Text>
                          <Text style={s.localHint}>Saved locally · demo request</Text>
                        </View>
                      )) : (
                        <View style={s.card}>
                          <Text style={s.cardTitle}>No leave requests yet</Text>
                          <Text style={s.small}>Your submitted requests and their status appear here.</Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}
                {page === "tasks" && (
                  <>
                    <View style={s.summary}>
                      <View style={s.taskSummaryItem}>
                        <Text style={s.taskSummaryValue}>{outstanding.length}</Text>
                        <Text style={s.taskSummaryLabel}>to do</Text>
                      </View>
                      <View style={s.taskSummaryDivider} />
                      <View style={s.taskSummaryItem}>
                        <Text style={s.taskSummaryValue}>
                          {outstanding.filter((t) => t.date === today).length}
                        </Text>
                        <Text style={s.taskSummaryLabel}>due today</Text>
                      </View>
                      <View style={s.taskSummaryDivider} />
                      <View style={s.taskSummaryItem}>
                        <Text style={s.taskSummaryValue}>
                          {records.tasks.length - outstanding.length}
                        </Text>
                        <Text style={s.taskSummaryLabel}>completed</Text>
                      </View>
                    </View>
                    <Field
                      label="Search tasks"
                      value={query}
                      onChange={setQuery}
                      placeholder="Search your assigned work"
                    />
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={s.chips}
                    >
                      {["All", "Today", "Open", "In progress", "Completed"].map(
                        (value) => (
                          <Pressable
                            key={value}
                            accessibilityRole="button"
                            accessibilityState={{ selected: filter === value }}
                            onPress={() => setFilter(value)}
                            style={[s.chip, filter === value && s.chipSelected]}
                          >
                            <Text
                              style={[
                                s.body,
                                filter === value && { color: colors.primary },
                              ]}
                            >
                              {value}
                            </Text>
                          </Pressable>
                        ),
                      )}
                    </ScrollView>
                    {records.tasks
                      .filter(
                        (t) =>
                          t.title.toLowerCase().includes(query.toLowerCase()) &&
                          (filter === "All" ||
                            (filter === "Today"
                              ? t.date === today
                              : t.status === filter)),
                      )
                      .map(taskCard)}
                    {!records.tasks.some(
                      (t) =>
                        t.title.toLowerCase().includes(query.toLowerCase()) &&
                        (filter === "All" ||
                          (filter === "Today"
                            ? t.date === today
                            : t.status === filter)),
                    ) && (
                      <Text style={s.small}>
                        No matches. Try another search or filter.
                      </Text>
                    )}
                  </>
                )}
                {page === "payroll" && (
                  <View style={[s.columns, splitLayout && s.desktopColumns]}>
                    <View style={s.column}>
                      <View
                        style={[
                          s.card,
                          { backgroundColor: "#EFE9FA", padding: 26 },
                        ]}
                      >
                        <Text style={s.eyebrow}>LATEST PUBLISHED PAY</Text>
                        <Text style={[s.sectionTitle, { marginTop: 12 }]}>
                          September 2026
                        </Text>
                        <Text style={s.payValue}>{money(42200)}</Text>
                        <Text style={s.subtitle}>Take-home pay · Paid</Text>
                        <Button
                          label="View payslip"
                          onPress={() => setDialog("payslip")}
                        />
                      </View>
                      <Text style={s.small}>
                        Only published payroll is visible here. Salary settings
                        and draft payroll do not count as paid salary.
                      </Text>
                    </View>
                    <View style={s.column}>
                      <Text style={s.sectionTitle}>Payslip history</Text>
                      <Tile
                        title="September 2026"
                        description="₹42,200 take-home · Paid"
                        symbol="▤"
                        onPress={() => setDialog("payslip")}
                      />
                    </View>
                  </View>
                )}
                {page === "profile" && (
                  <View style={[s.columns, splitLayout && s.desktopColumns]}>
                    <View style={[s.card, s.column]}>
                      <View style={s.row}>
                        <View style={[s.avatar, { width: 60, height: 60 }]}>
                          <Text style={[s.avatarText, { fontSize: 22 }]}>
                            AR
                          </Text>
                        </View>
                        <View style={s.flex}>
                          <Text style={s.sectionTitle}>{employee.name}</Text>
                          <Text style={s.small}>
                            {employee.department} · {employee.branch}
                          </Text>
                        </View>
                      </View>
                      <View style={s.divider} />
                      {[
                        ["Employee ID", employee.id],
                        ["Work email", employee.email],
                        ["Department", employee.department],
                        ["Manager", employee.manager],
                        ["Phone", employee.phone],
                      ].map(([label, value]) => (
                        <View key={label} style={s.detail}>
                          <Text style={s.small}>{label}</Text>
                          <Text style={s.body}>{value}</Text>
                        </View>
                      ))}
                      <Text style={s.small}>
                        Ask your manager to update your employment details.
                      </Text>
                    </View>
                    <View style={s.column}>
                      <Tile
                        title="Leave & requests"
                        description="Apply and track requests"
                        symbol="♧"
                        onPress={() => go("leave")}
                      />
                      <Tile
                        title="My documents"
                        description="Employment records"
                        symbol="▤"
                        onPress={() => go("documents")}
                      />
                      <Tile
                        title="Salary advances"
                        description="Request and track"
                        symbol="▤"
                        lavender
                        onPress={() => go("advances")}
                      />
                      <Tile
                        title="Help"
                        description="Using your workspace"
                        symbol="help"
                        amber
                        onPress={() => go("help")}
                      />
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => { setDialog(null); setMessage(""); setSignedOut(true); }}
                        style={({ pressed }) => [s.signOut, pressed && { opacity: 0.65 }]}
                      >
                        <Text style={s.cardTitle}>Sign out</Text>
                      </Pressable>
                      <Text style={[s.small, { textAlign: "center" }]}>
                        Your attendance, payslips and assigned tasks stay linked to your employee account.
                      </Text>
                      <Text style={s.small}>
                        This offline workspace uses fictional APK sample data. A
                        backend is needed to connect employee and manager
                        accounts across devices.
                      </Text>
                    </View>
                  </View>
                )}
                {page === "documents" && (
                  <View style={s.column}>
                    {(records.documents ?? sampleDocuments).map(
                      (document) => (
                        <View key={document.id} style={[s.card, { gap: 16 }]}>
                          <View style={s.row}>
                            <Icon symbol="document" />
                            <View style={s.flex}>
                              <Text style={s.cardTitle}>{document.title}</Text>
                              <Text style={s.small}>{documentDate(document.date)} · {document.kind}</Text>
                            </View>
                            <View style={[s.documentBadge, document.status === "Verified" && { backgroundColor: "#E2F4EC" }]}>
                              <Text style={[s.documentBadgeText, document.status === "Verified" && { color: colors.primary }]}>{document.status}</Text>
                            </View>
                          </View>
                          <Pressable accessibilityRole="button" accessibilityLabel={`Preview and save ${document.title}`} style={({ pressed }) => [s.documentPreview, pressed && { opacity: 0.65 }]} onPress={() => { setActiveDocument(document); setDialog("document"); }}>
                            <Text style={s.documentButtonText}>Preview & save</Text>
                          </Pressable>
                        </View>
                      ),
                    )}
                    <Pressable accessibilityRole="button" style={({ pressed }) => [s.createLetter, pressed && { opacity: 0.65 }]} onPress={() => {
                      const date = dayKey();
                      const document: EmployeeDocument = { id: `letter-${Date.now()}`, title: "Sample employment letter", date, kind: "Letter", status: "Available", content: employmentLetter(date) };
                      setRecords((current) => ({ ...current, documents: [...(current.documents ?? sampleDocuments), document] }));
                      setActiveDocument(document); setDialog("document");
                    }}>
                      <Text style={[s.documentButtonText, { color: colors.primary }]}>Create sample employment letter</Text>
                    </Pressable>
                  </View>
                )}
                {page === "advances" && (
                  <View style={s.column}>
                    <View style={[s.card, { gap: 12 }]}>
                      <Text style={s.sectionTitle}>Request an advance</Text>
                      <Text style={s.small}>Sample requests are saved on this device for tracking.</Text>
                      <Field label="Amount (INR)" value={advanceAmount} onChange={setAdvanceAmount} placeholder="Enter amount" />
                      <Field label="Reason" value={advanceReason} onChange={setAdvanceReason} multiline placeholder="What is the advance for?" />
                      {!!advanceError && <Text accessibilityRole="alert" style={s.error}>{advanceError}</Text>}
                      <Button label="Request advance" disabled={!loaded} onPress={() => {
                        const amount = Number(advanceAmount.trim());
                        if (!Number.isFinite(amount) || amount <= 0 || !/^\d+(\.\d{1,2})?$/.test(advanceAmount.trim()) || !advanceReason.trim()) {
                          setAdvanceError("Enter a positive amount with up to two decimal places and a reason.");
                          return;
                        }
                        setRecords((current) => ({ ...current, advances: [
                          { id: `${Date.now()}`, amount, reason: advanceReason.trim(), date: dayKey(), status: "Pending" },
                          ...(current.advances ?? []),
                        ] }));
                        setAdvanceAmount(""); setAdvanceReason(""); setAdvanceError("");
                        setMessage("Sample advance request saved.");
                      }} />
                    </View>
                    <Text style={s.sectionTitle}>Request history</Text>
                    {(records.advances ?? []).map((advance) => (
                      <View key={advance.id} style={[s.card, { gap: 8 }]}>
                        <View style={s.between}><Text style={s.cardTitle}>{money(advance.amount)}</Text><Badge label={advance.status} /></View>
                        <Text style={s.body}>{advance.reason}</Text>
                        <Text style={s.small}>{displayDate(advance.date)}</Text>
                      </View>
                    ))}
                    {!records.advances?.length && <Text style={s.small}>No salary advance requests yet.</Text>}
                  </View>
                )}
                {page === "help" && (
                  <View style={s.column}>
                    {[
                      ["Attendance", "Check in and out from My work. Review your shifts in Attendance."],
                      ["Tasks", "Open an assigned task to add progress notes or mark it completed."],
                      ["Leave & requests", "Apply for leave from Profile and track your request status."],
                      ["Payroll and documents", "View published payslips in Payroll and employment records in My documents."],
                      ["Salary advances", "Create a sample advance request and review its history on this device."],
                      ["Need help?", `Contact your manager, ${employee.manager}, about employment details or payroll. This sample workspace saves records locally and does not send requests to a manager.`],
                    ].map(([heading, text]) => (
                      <View key={heading} style={[s.card, { gap: 8 }]}><Text style={s.cardTitle}>{heading}</Text><Text style={s.body}>{text}</Text></View>
                    ))}
                  </View>
                )}
                <Text style={s.footer}>Offline sample workspace · v2.3</Text>
              </>
            )}
          </ScrollView>
          {!desktop && (
            <View accessibilityRole="tablist" style={s.bottomNav}>
              {nav(false)}
            </View>
          )}
        </View>
      </View>
      {!!message && (
        <View
          accessibilityRole="alert"
          style={[s.toast, { bottom: desktop ? 24 : 92 }]}
        >
          <Text style={s.toastText}>{message}</Text>
        </View>
      )}
      <Modal
        visible={dialog !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setDialog(null)}
      >
        <KeyboardAvoidingView
          style={s.overlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={s.modal}>
            <View style={s.between}>
              <Text accessibilityRole="header" style={s.sectionTitle}>
                {dialog === "leave"
                  ? "Apply for leave"
                  : dialog === "task"
                    ? "Update task"
                    : dialog === "search"
                      ? "Find a module"
                      : dialog === "document"
                        ? activeDocument?.title ?? "Document preview"
                      : "September 2026 payslip"}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close dialog"
                onPress={() => setDialog(null)}
                style={s.close}
              >
                <Text style={s.closeText}>×</Text>
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              {dialog === "document" && activeDocument && (
                <View style={{ gap: 16, paddingVertical: 20 }}>
                  <Text selectable style={s.body}>{activeDocument.content}</Text>
                  <Button label={savingDocument ? "Saving…" : "Save on this device"} disabled={savingDocument} onPress={async () => {
                    setSavingDocument(true);
                    try {
                      await AsyncStorage.setItem(`${STORAGE_KEY}:document:${activeDocument.id}`, JSON.stringify(activeDocument));
                      setMessage("Document saved in this sample workspace on your device.");
                    } catch {
                      setMessage("Could not save the document. Please try again.");
                    } finally { setSavingDocument(false); }
                  }} />
                  <Button label="Share document" secondary onPress={async () => {
                    try { await Share.share({ title: activeDocument.title, message: activeDocument.content }); }
                    catch { setMessage("Sharing is unavailable on this device."); }
                  }} />
                </View>
              )}
              {dialog === "leave" && (
                <>
                  <View style={s.chips}>
                    {["Casual leave", "Sick leave"].map((value) => (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ selected: value === leaveType }}
                        key={value}
                        style={[s.chip, value === leaveType && s.chipSelected]}
                        onPress={() => setLeaveType(value)}
                      >
                        <Text style={s.body}>{value}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <Field
                    label="From (YYYY-MM-DD)"
                    value={from}
                    onChange={setFrom}
                  />
                  <Field label="To (YYYY-MM-DD)" value={to} onChange={setTo} />
                  <Field
                    label="Reason"
                    value={reason}
                    onChange={setReason}
                    multiline
                  />
                  <Text style={[s.small, { marginBottom: 16 }]}>
                    Casual: {leaveBalance("Casual leave")} days · Sick:{" "}
                    {leaveBalance("Sick leave")} days. Calendar days are used in
                    this demo.
                  </Text>
                  <Text style={[s.small, { marginBottom: 16 }]}>
                    This request is saved on this device for the demo.
                  </Text>
                  {!!formError && (
                    <Text accessibilityRole="alert" style={s.error}>
                      {formError}
                    </Text>
                  )}
                  <Button label="Submit leave request" onPress={submitLeave} />
                </>
              )}
              {dialog === "task" && activeTask && (
                <>
                  <Text style={[s.cardTitle, { marginVertical: 15 }]}>
                    {activeTask.title}
                  </Text>
                  <Text style={s.small}>
                    {displayDate(activeTask.date)} · {activeTask.time} ·
                    Assigned by Business Admin
                  </Text>
                  <View style={[s.chips, { flexWrap: "wrap", marginTop: 18 }]}>
                    {(["Open", "In progress", "Completed"] as const).map(
                      (value) => (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityState={{
                            selected: value === taskStatus,
                          }}
                          key={value}
                          style={[
                            s.chip,
                            taskStatus === value && s.chipSelected,
                          ]}
                          onPress={() => setTaskStatus(value)}
                        >
                          <Text style={s.body}>{value}</Text>
                        </Pressable>
                      ),
                    )}
                  </View>
                  <Field
                    label="Progress / completion note"
                    value={taskNote}
                    onChange={setTaskNote}
                    multiline
                  />
                  {!!formError && (
                    <Text accessibilityRole="alert" style={s.error}>
                      {formError}
                    </Text>
                  )}
                  <Button
                    label="Save update"
                    onPress={() => {
                      if (taskStatus === "Completed" && !taskNote.trim()) {
                        setFormError(
                          "Add a completion note before marking this task completed.",
                        );
                        return;
                      }
                      setRecords((r) => ({
                        ...r,
                        tasks: r.tasks.map((t) =>
                          t.id === activeTask.id
                            ? {
                                ...t,
                                status: taskStatus,
                                note: taskNote.trim(),
                              }
                            : t,
                        ),
                      }));
                      setDialog(null);
                      setMessage("Task update saved.");
                    }}
                  />
                </>
              )}
              {dialog === "payslip" && (
                <>
                  <Text style={[s.eyebrow, { marginTop: 20 }]}>
                    EMPLOYEE PAYSLIP
                  </Text>
                  <Text style={[s.sectionTitle, { marginTop: 10 }]}>
                    {employee.company}
                  </Text>
                  <Text style={s.subtitle}>
                    {employee.name} · {employee.id}
                  </Text>
                  <Badge label="Paid" />
                  <View style={s.divider} />
                  <Text style={s.sectionTitle}>Earnings</Text>
                  {[
                    ["Basic salary", 24300],
                    ["House rent allowance", 12150],
                    ["Special allowance", 8550],
                    ["Gross earnings", 45000],
                    ["Retirement contribution", 1800],
                    ["Demo tax deduction", 1000],
                    ["Total deductions", 2800],
                  ].map(([label, value]) => (
                    <View style={s.moneyRow} key={label}>
                      <Text style={s.body}>{label}</Text>
                      <Text style={s.bold}>{money(Number(value))}</Text>
                    </View>
                  ))}
                  <View style={[s.moneyRow, s.total]}>
                    <Text style={s.cardTitle}>Net take-home</Text>
                    <Text style={s.cardTitle}>{money(42200)}</Text>
                  </View>
                  <Text style={s.localHint}>
                    Fictional sample payslip. Not an employment record.
                  </Text>
                </>
              )}
              {dialog === "search" && (
                <>
                  <Field
                    label="Search workspace"
                    value={query}
                    onChange={setQuery}
                    placeholder="Attendance, tasks, payroll…"
                  />
                  {navigation
                    .filter((item) =>
                      item.label.toLowerCase().includes(query.toLowerCase()),
                    )
                    .map((item) => (
                      <Tile
                        key={item.page}
                        title={item.label}
                        description="Open workspace"
                        symbol={item.symbol}
                        onPress={() => go(item.page)}
                      />
                    ))}
                  {!navigation.some((item) =>
                    item.label.toLowerCase().includes(query.toLowerCase()),
                  ) && <Text style={s.small}>No matching modules.</Text>}
                </>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  shell: { flex: 1, flexDirection: "row" },
  flex: { flex: 1 },
  sidebar: {
    width: 224,
    backgroundColor: "#FCFDFF",
    borderRightWidth: 1,
    borderColor: colors.border,
    padding: 22,
    paddingTop: 28,
  },
  brandIcon: {
    width: 36,
    height: 36,
    backgroundColor: colors.primary,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  brandSymbol: { fontSize: 25, color: "white" },
  brand: { fontSize: 17, color: colors.ink, fontWeight: "700" },
  caption: {
    fontSize: 10,
    color: colors.muted,
    letterSpacing: 1.3,
    marginBottom: 18,
  },
  sideItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 13,
    borderRadius: 12,
    marginBottom: 7,
  },
  sideActive: {
    backgroundColor: "#E5F3ED",
    borderLeftWidth: 3,
    borderLeftColor: "#7FB5A1",
  },
  sideSymbol: { fontSize: 23, color: colors.muted },
  sideLabel: { color: colors.muted, fontSize: 13 },
  sideFooter: { marginTop: "auto", paddingTop: 30 },
  topbar: {
    minHeight: 70,
    backgroundColor: "white",
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  topbarCompact: {
    flexWrap: "wrap",
    paddingTop: 10,
    paddingBottom: 10,
  },
  topbarMeta: { minWidth: 0, flexShrink: 1 },
  topbarActions: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: "#DAF1EC",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 13, fontWeight: "700", color: "#146F65" },
  searchButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#F5F7FB",
    alignItems: "center",
    justifyContent: "center",
  },
  searchSymbol: { fontSize: 29, color: colors.ink },
  content: { padding: 20, paddingBottom: 32 },
  title: {
    fontSize: 29,
    fontWeight: "700",
    letterSpacing: -0.8,
    color: colors.ink,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 21,
    marginTop: 5,
    marginBottom: 18,
  },
  greeting: {
    paddingBottom: 18,
  },
  greetingSubtitle: { fontSize: 12, color: colors.muted, lineHeight: 19, marginTop: 4 },
  eyebrow: {
    fontSize: 10,
    color: "#35877A",
    letterSpacing: 1.2,
    fontWeight: "600",
  },
  hello: {
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: -0.8,
    color: colors.ink,
    marginTop: 0,
  },
  columns: { gap: 22 },
  desktopColumns: { flexDirection: "row", gap: 25 },
  column: { flex: 1, gap: 12, minWidth: 0 },
  card: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 18,
  },
  signOut: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  documentBack: { width: 38, height: 38, borderRadius: 10, backgroundColor: "white", borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  documentBadge: { backgroundColor: "#EFF2F7", paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6 },
  documentBadgeText: { fontSize: 10, color: colors.muted, fontWeight: "600" },
  documentPreview: { minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  documentButtonText: { fontSize: 13, fontWeight: "700", color: colors.ink },
  createLetter: { minHeight: 48, backgroundColor: "#E9EEFF", borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 12, paddingHorizontal: 12 },
  shiftCard: { borderRadius: 23, borderColor: "#D9EAE2", backgroundColor: "#F7FCF9", padding: 22 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  between: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  cardTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 21,
  },
  small: { color: colors.muted, fontSize: 12, lineHeight: 19 },
  body: { color: colors.ink, fontSize: 14, lineHeight: 21 },
  bold: { color: colors.ink, fontWeight: "700" },
  icon: {
    width: 41,
    height: 41,
    borderRadius: 13,
    backgroundColor: "#E2F6F0",
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: { fontSize: 25, color: "#167E6C" },
  badge: {
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  badgeText: { fontSize: 10, fontWeight: "600" },
  times: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginVertical: 20,
    paddingVertical: 17,
    paddingHorizontal: 15,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#E2EDE7",
    borderRadius: 15,
  },
  time: { fontSize: 26, fontWeight: "700", color: colors.ink, marginTop: 5 },
  timeLine: { flex: 0.7, height: 1, backgroundColor: "#E0EAE8" },
  button: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
  },
  secondary: { backgroundColor: "#E5F3ED" },
  buttonText: { color: "white", fontWeight: "700", fontSize: 14 },
  localHint: {
    textAlign: "center",
    color: colors.muted,
    fontSize: 10,
    lineHeight: 17,
    marginTop: 13,
  },
  tile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 15,
    padding: 16,
    minHeight: 86,
    marginBottom: 1,
  },
  chevron: { color: "#9AA6B8", fontSize: 26 },
  metrics: { flexDirection: "row", gap: 10 },
  metric: {
    flex: 1,
    minWidth: 0,
    borderRadius: 16,
    padding: 16,
    minHeight: 154,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metricLabel: { fontSize: 11, color: colors.muted, marginTop: 14 },
  metricValue: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.8,
    color: colors.ink,
    marginTop: 8,
    marginBottom: 7,
  },
  section: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 2,
  },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: colors.ink },
  link: { color: colors.primary, fontSize: 12, fontWeight: "600", padding: 8 },
  taskCard: { marginBottom: 2 },
  footer: {
    color: "#7C8E9C",
    fontSize: 10,
    textAlign: "center",
    marginTop: 30,
  },
  bottomNav: {
    flexDirection: "row",
    backgroundColor: "white",
    borderTopWidth: 1,
    borderColor: colors.border,
    padding: 7,
    gap: 3,
  },
  navItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 7,
    borderRadius: 12,
    gap: 3,
  },
  navActive: { backgroundColor: "#E5F3ED" },
  navSymbol: { fontSize: 24, color: colors.muted },
  navLabel: { color: colors.muted, fontSize: 10 },
  summary: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 18,
    paddingHorizontal: 14,
    borderRadius: 16,
    marginBottom: 16,
  },
  taskSummaryItem: { flex: 1, minWidth: 0 },
  taskSummaryValue: {
    color: colors.ink,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700",
  },
  taskSummaryLabel: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 2,
  },
  taskSummaryDivider: {
    width: 1,
    height: 36,
    backgroundColor: colors.border,
    marginRight: 10,
  },
  chips: { flexDirection: "row", gap: 8, paddingBottom: 14 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 8,
    backgroundColor: "white",
  },
  chipSelected: { backgroundColor: "#E2F4EC", borderColor: "#8EBBAF" },
  payValue: {
    fontSize: 42,
    color: colors.ink,
    fontWeight: "700",
    marginTop: 15,
  },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 20 },
  detail: { gap: 4, marginBottom: 12 },
  overlay: {
    flex: 1,
    backgroundColor: "#17263F88",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modal: {
    backgroundColor: "white",
    borderRadius: 22,
    padding: 22,
    width: "100%",
    maxWidth: 560,
    maxHeight: "90%",
  },
  close: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: { color: colors.muted, fontSize: 28 },
  field: { marginBottom: 16 },
  label: {
    fontSize: 12,
    color: colors.ink,
    fontWeight: "600",
    marginBottom: 7,
  },
  input: {
    borderWidth: 1,
    borderColor: "#CDDCD7",
    borderRadius: 11,
    padding: 13,
    fontSize: 14,
    color: colors.ink,
    backgroundColor: "#FBFDFC",
    minHeight: 46,
  },
  error: { color: "#B3293E", fontSize: 12, lineHeight: 19, marginBottom: 16 },
  moneyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 10,
  },
  total: { borderTopWidth: 1, borderColor: colors.border, marginTop: 10 },
  toast: {
    position: "absolute",
    left: 20,
    right: 20,
    maxWidth: 500,
    alignSelf: "center",
    backgroundColor: "#17263F",
    borderRadius: 13,
    padding: 16,
  },
  toastText: { color: "white", textAlign: "center", fontSize: 13 },
});
