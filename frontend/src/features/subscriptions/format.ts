/** Display helpers for billing screens (no business logic). */

export const formatRupees = (paise: number): string =>
  `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(paise / 100)}`;

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

const STATUS_LABEL: Record<string, string> = {
  PENDING_ACTIVATION: "Awaiting payment",
  ACTIVE: "Active",
  PAST_DUE: "Expired",
  EXPIRED: "Expired",
  CANCELLED: "Expired",
  MISSING: "Not found",
};

export const statusLabel = (status: string): string => STATUS_LABEL[status] ?? "Unknown";

export function daysLeftLabel(days: number): string {
  if (days <= 0) return "Expires today";
  return days === 1 ? "1 day remaining" : `${days} days remaining`;
}

const PAYMENT_LABEL: Record<string, string> = {
  CAPTURED: "Paid",
  AUTHORIZED: "Authorised",
  FAILED: "Failed",
  REJECTED: "Rejected",
  REFUNDED: "Refunded",
  CREATED: "Started",
};
export const paymentStatusLabel = (status: string): string => PAYMENT_LABEL[status] ?? status;

/** Whole days until `expiresAt` (rounded up); 0 when past or unknown. */
export function remainingDays(expiresAt: string | null | undefined, now = Date.now()): number {
  if (!expiresAt) return 0;
  const ms = Date.parse(expiresAt) - now;
  return Number.isFinite(ms) && ms > 0 ? Math.ceil(ms / 86_400_000) : 0;
}
