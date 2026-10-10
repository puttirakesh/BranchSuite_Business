export type Page = "home" | "attendance" | "tasks" | "payroll" | "leave" | "profile" | "documents" | "advances" | "help";
export type Task = {
  id: string;
  title: string;
  type: string;
  date: string;
  time: string;
  high?: boolean;
  status: "Open" | "In progress" | "Completed";
  note: string;
};
export type Shift = { date: string; inTime: string; outTime: string };
export type Leave = {
  id: string;
  type: string;
  from: string;
  to: string;
  reason: string;
  status: string;
};
export type Advance = { id: string; amount: number; reason: string; date: string; status: "Pending" };
export type EmployeeDocument = { id: string; title: string; date: string; kind: "Letter" | "Verification"; status: "Available" | "Verified"; content: string };
export type Records = { shifts: Shift[]; tasks: Task[]; leaves: Leave[]; advances?: Advance[]; documents?: EmployeeDocument[] };
export const STORAGE_KEY = "branchsuite:employee:EMP0082:v2.3";
export const employee = {
  name: "Ananya Rao",
  id: "EMP0082",
  branch: "Vijayawada",
  company: "5 Gen Educon",
  department: "Operations",
  manager: "Kavitha Reddy",
  email: "ananya.rao.82@demo.example",
  phone: "+91 90000 10082",
};
export const colors = {
  ink: "#17263F",
  muted: "#5F7088",
  primary: "#11786D",
  background: "#F4F9F7",
  border: "#E0E7F0",
};
export function employmentLetter(date: string) {
  return `${employee.company}\nSample employment confirmation\nDate: ${date}\n\nTo whom it may concern,\n\nThis sample letter confirms that ${employee.name} (${employee.id}) is employed in the ${employee.department} department at our ${employee.branch} branch, reporting to ${employee.manager}.\n\nThis document uses fictional sample data and is for demonstration only.\n\n${employee.company}\nHuman Resources`;
}
export const sampleDocuments: EmployeeDocument[] = [
  { id: "employment", title: "Employment confirmation", date: "2025-06-02", kind: "Letter", status: "Available", content: employmentLetter("2025-06-02") },
  { id: "bank", title: "Bank verification", date: "2026-09-15", kind: "Verification", status: "Verified", content: `${employee.company}\nSample bank verification\nDate: 2026-09-15\n\nEmployee: ${employee.name}\nEmployee ID: ${employee.id}\n\nBank details are marked verified in this fictional sample workspace. No actual bank account has been verified.\n\nFor demonstration only.` },
];
export function documentDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
export const navigation: { page: Page; label: string; symbol: string }[] = [
  { page: "home", label: "My work", symbol: "⌂" },
  { page: "attendance", label: "Attendance", symbol: "◷" },
  { page: "tasks", label: "My tasks", symbol: "☑" },
  { page: "payroll", label: "My payroll", symbol: "▤" },
  { page: "leave", label: "Leave & requests", symbol: "♧" },
  { page: "profile", label: "My profile", symbol: "♙" },
];
export function dayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const date = new Date(`${value}T12:00:00`);
  return !Number.isNaN(date.getTime()) && dayKey(date) === value;
}
export function leaveDays(from: string, to: string) {
  return (
    Math.round(
      (Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) /
        86400000,
    ) + 1
  );
}
export function displayDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}
export const money = (amount: number) => `₹${amount.toLocaleString("en-IN")}`;
export function initialRecords(): Records {
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
export function validRecords(value: unknown): value is Records {
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
