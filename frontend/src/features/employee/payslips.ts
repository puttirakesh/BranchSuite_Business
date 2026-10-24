export type PayrollComponent = {
  id: string;
  name: string;
  kind: "EARNING" | "DEDUCTION";
  amount: number;
};

export type EmployeePayslip = {
  identity?: import('./payslip-pdf-content').Identity;
  paidDays?: number;
  periodDays?: number;
  id: string;
  currency: string;
  basicAmount: number;
  grossAmount: number;
  deductionsAmount: number;
  netAmount: number;
  runStatus: "APPROVED" | "PAID";
  month: number;
  year: number;
  components: PayrollComponent[];
  paymentDate: string | null;
  paymentRecorded: boolean;
  paid: boolean;
  paymentMethod: string | null;
  paymentReference: string | null;
};

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asAmount(value: unknown): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  if (typeof value !== "string" && typeof value !== "number") return null;
  if (typeof value === "string" && !value.trim()) return null;
  const amount = Number(value);

  return Number.isFinite(amount) ? amount : null;
}

export function formatMoney(
  amount: number,
  currency: string,
): string {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString("en-IN")}`;
  }
}

export function periodLabel(month: number, year: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString(
    "en-IN",
    {
      month: "long",
      year: "numeric",
    },
  );
}

export function paymentDateLabel(dateValue: string): string {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "Payment date unavailable";
  }

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function normalizePayslip(
  value: unknown,
): EmployeePayslip {
  if (!isObject(value)) {
    throw new Error("Invalid payroll entry received.");
  }

  const run = value.run;

  if (!isObject(run) || !isObject(run.period)) {
    throw new Error("Payroll period information is missing.");
  }

  const period = run.period;

  const id = asString(value.id);
  const month = asAmount(period.month);
  const year = asAmount(period.year);

  // Actual Prisma PayrollEntry field names.
  const basicAmount = asAmount(value.basicAmount);
  const grossAmount = asAmount(value.grossAmount);
  const deductionsAmount = asAmount(
    value.deductionsAmount,
  );
  const netAmount = asAmount(value.netAmount);

  const runStatus = asString(run.status);

  if (
    !id ||
    month === null ||
    year === null ||
    year < 1900 ||
    year > 9999 ||
    !Number.isInteger(month) ||
    !Number.isInteger(year) ||
    month < 1 ||
    month > 12 ||
    basicAmount === null ||
    grossAmount === null ||
    deductionsAmount === null ||
    netAmount === null ||
    (runStatus !== "APPROVED" &&
      runStatus !== "PAID")
  ) {
    throw new Error(
      "The backend returned incomplete payroll information.",
    );
  }

  const rawComponents = value.components;

  if (!Array.isArray(rawComponents)) {
    throw new Error(
      "Payroll component details are missing.",
    );
  }

  const components: PayrollComponent[] =
    rawComponents.map((component) => {
      if (!isObject(component)) {
        throw new Error("Invalid salary component.");
      }

      const amount = asAmount(component.amount);
      const kind = asString(component.kind);

      if (
        !asString(component.id) ||
        !asString(component.name) ||
        amount === null ||
        (kind !== "EARNING" &&
          kind !== "DEDUCTION")
      ) {
        throw new Error(
          "Invalid salary component details.",
        );
      }

      return {
        id: asString(component.id),
        name: asString(component.name),
        kind,
        amount,
      };
    });

  // PayrollPayment is recorded separately.
  // Its createdAt timestamp is used when provided.
  const payment = isObject(value.payment)
    ? value.payment
    : null;

  const paymentDate =
    payment
      ? asString(payment.paidAt) ||
        asString(payment.createdAt) ||
        null
      : null;

  return {
    identity: isObject(value.identitySnapshot) ? value.identitySnapshot as unknown as import('./payslip-pdf-content').Identity : undefined,
    paidDays: asAmount(value.paidDays) ?? undefined,
    periodDays: asAmount(value.periodDays) ?? undefined,
    id,
    currency: asString(value.currency) || "INR",
    basicAmount,
    grossAmount,
    deductionsAmount,
    netAmount,
    runStatus,
    month,
    year,
    components,
    paymentDate,
    paymentRecorded: payment !== null,
    paid: payment !== null || runStatus === "PAID",
    paymentMethod: payment ? asString(payment.method) || null : null,
    paymentReference: payment ? asString(payment.reference) || null : null,
  };
}

export function paymentStatusLabel(payslip: EmployeePayslip): string {
  if (payslip.paymentRecorded) {
    return payslip.paymentDate ? `Paid on ${paymentDateLabel(payslip.paymentDate)}` : "Payment recorded";
  }
  return payslip.paid ? "Marked paid - date not provided" : "Approved - awaiting payment";
}

export function normalizePayslips(data: unknown): EmployeePayslip[] {
  if (!Array.isArray(data)) throw new Error("Unexpected payslip API response.");
  return data.map(normalizePayslip).sort((a, b) => b.year - a.year || b.month - a.month);
}
