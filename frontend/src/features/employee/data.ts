
/**
 * BranchSuite Business
 * Employee shared types and utilities
 *
 * No hardcoded employee or business data.
 *
 * Employee details, tasks, attendance,
 * leave, and payroll must be obtained
 * from their respective backend APIs.
 */

// =====================================================
// EMPLOYEE NAVIGATION
// =====================================================

export type Page =
  | "home"
  | "attendance"
  | "tasks"
  | "payroll"
  | "leave"
  | "profile"
  | "documents"
  | "advances"
  | "help";

// =====================================================
// TASK TYPES
// =====================================================

/**
 * Legacy task shape used by existing employee
 * workspace components.
 *
 * Backend Task Management uses its own API types.
 */
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

// =====================================================
// ATTENDANCE TYPES
// =====================================================

export type Shift = {
  date: string;
  inTime: string;
  outTime: string;
};

// =====================================================
// LEAVE TYPES
// =====================================================

export type Leave = {
  id: string;
  type: string;
  from: string;
  to: string;
  reason: string;
  status: string;
};

// =====================================================
// ADVANCE TYPES
// =====================================================

export type Advance = {
  id: string;
  amount: number;
  reason: string;
  date: string;
  status: "Pending";
};

// =====================================================
// DOCUMENT TYPES
// =====================================================

export type EmployeeDocument = {
  id: string;
  title: string;
  date: string;
  kind: "Letter" | "Verification";
  status: "Available" | "Verified";
  content: string;
};

// =====================================================
// LEGACY LOCAL RECORDS
// =====================================================

/**
 * Retained for compatibility with existing
 * Employee Workspace components.
 *
 * Backend-integrated screens should not use
 * these local records as authoritative data.
 */
export type Records = {
  shifts: Shift[];
  tasks: Task[];
  leaves: Leave[];
  advances?: Advance[];
  documents?: EmployeeDocument[];
};

// =====================================================
// LOCAL STORAGE KEY
// =====================================================

/**
 * Keep the previous storage key temporarily
 * to avoid silently losing existing local data.
 *
 * This key is not suitable for storing records
 * for multiple users on the same device.
 *
 * Backend records must not be stored under
 * this shared legacy key.
 */
export const STORAGE_KEY =
  "branchsuite:employee:EMP0082:v2.3";

// =====================================================
// UI COLORS
// =====================================================

export const colors = {
  ink: "#17263F",
  muted: "#5F7088",
  primary: "#11786D",
  background: "#F4F9F7",
  border: "#E0E7F0",
};

// =====================================================
// NAVIGATION ITEMS
// =====================================================

export const navigation: {
  page: Page;
  label: string;
  symbol: string;
}[] = [
  {
    page: "home",
    label: "My work",
    symbol: "⌂",
  },
  {
    page: "attendance",
    label: "Attendance",
    symbol: "◷",
  },
  {
    page: "tasks",
    label: "My tasks",
    symbol: "☑",
  },
  {
    page: "payroll",
    label: "My payroll",
    symbol: "▤",
  },
  {
    page: "leave",
    label: "Leave & requests",
    symbol: "♧",
  },
  {
    page: "profile",
    label: "My profile",
    symbol: "♙",
  },
];

// =====================================================
// DATE UTILITIES
// =====================================================

/**
 * Returns a local calendar date in YYYY-MM-DD.
 */
export function dayKey(
  date: Date = new Date(),
): string {
  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1,
  ).padStart(2, "0");

  const day = String(
    date.getDate(),
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/**
 * Validates a YYYY-MM-DD calendar date.
 */
export function validDate(
  value: unknown,
): value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const date = new Date(`${value}T12:00:00`);

  return (
    !Number.isNaN(date.getTime()) &&
    dayKey(date) === value
  );
}

/**
 * Inclusive calendar days between dates.
 *
 * This is a general date helper, not the
 * company's authoritative leave policy.
 */
export function leaveDays(
  from: string,
  to: string,
): number {
  if (!validDate(from) || !validDate(to)) {
    return 0;
  }

  if (to < from) {
    return 0;
  }

  const start = Date.parse(`${from}T12:00:00Z`);
  const end = Date.parse(`${to}T12:00:00Z`);

  return Math.round(
    (end - start) / 86400000,
  ) + 1;
}

/**
 * Full date for documents and leave requests.
 */
export function documentDate(
  value: string,
): string {
  const datePart = value.slice(0, 10);

  if (!validDate(datePart)) {
    return "Date unavailable";
  }

  return new Date(
    `${datePart}T12:00:00`,
  ).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Short date format for cards.
 */
export function displayDate(
  value: string,
): string {
  const datePart = value.slice(0, 10);

  if (!validDate(datePart)) {
    return "Date unavailable";
  }

  return new Date(
    `${datePart}T12:00:00`,
  ).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

// =====================================================
// MONEY FORMATTING
// =====================================================

/**
 * UI currency formatting.
 *
 * Currency is currently INR.
 * Amounts must come from backend payroll records.
 */
export function money(
  amount: number,
): string {
  if (!Number.isFinite(amount)) {
    return "—";
  }

  return new Intl.NumberFormat(
    "en-IN",
    {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    },
  ).format(amount);
}

// =====================================================
// INITIAL WORKSPACE DATA
// =====================================================

/**
 * New sessions start with no fabricated records.
 *
 * Real data must come from backend APIs.
 */
export function initialRecords(): Records {
  return {
    shifts: [],
    tasks: [],
    leaves: [],
    advances: [],
    documents: [],
  };
}

// =====================================================
// LOCAL RECORD VALIDATION
// =====================================================

/**
 * Retained for backwards compatibility with
 * existing local-only workspace features.
 *
 * Valid local records do not establish that
 * their contents were saved to PostgreSQL.
 */
export function validRecords(
  value: unknown,
): value is Records {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return false;
  }

  const record = value as Records;

  const documentsValid =
    record.documents === undefined ||
    (
      Array.isArray(record.documents) &&
      record.documents.every(
        (item) =>
          item !== null &&
          typeof item === "object" &&
          typeof item.id === "string" &&
          typeof item.title === "string" &&
          validDate(item.date) &&
          (
            item.kind === "Letter" ||
            item.kind === "Verification"
          ) &&
          (
            item.status === "Available" ||
            item.status === "Verified"
          ) &&
          typeof item.content === "string",
      )
    );

  const advancesValid =
    record.advances === undefined ||
    (
      Array.isArray(record.advances) &&
      record.advances.every(
        (item) =>
          item !== null &&
          typeof item === "object" &&
          typeof item.id === "string" &&
          Number.isFinite(item.amount) &&
          item.amount > 0 &&
          typeof item.reason === "string" &&
          validDate(item.date) &&
          item.status === "Pending",
      )
    );

  const shiftsValid =
    Array.isArray(record.shifts) &&
    record.shifts.every(
      (item) =>
        item !== null &&
        typeof item === "object" &&
        validDate(item.date) &&
        typeof item.inTime === "string" &&
        typeof item.outTime === "string",
    );

  const tasksValid =
    Array.isArray(record.tasks) &&
    record.tasks.every(
      (item) =>
        item !== null &&
        typeof item === "object" &&
        typeof item.id === "string" &&
        typeof item.title === "string" &&
        typeof item.type === "string" &&
        validDate(item.date) &&
        typeof item.time === "string" &&
        typeof item.note === "string" &&
        (
          item.status === "Open" ||
          item.status === "In progress" ||
          item.status === "Completed"
        ),
    );

  const leavesValid =
    Array.isArray(record.leaves) &&
    record.leaves.every(
      (item) =>
        item !== null &&
        typeof item === "object" &&
        typeof item.id === "string" &&
        typeof item.type === "string" &&
        validDate(item.from) &&
        validDate(item.to) &&
        item.to >= item.from &&
        typeof item.reason === "string" &&
        typeof item.status === "string",
    );

  return (
    documentsValid &&
    advancesValid &&
    shiftsValid &&
    tasksValid &&
    leavesValid
  );
}
