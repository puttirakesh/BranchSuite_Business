const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

/** APK money format: "₹2,499". */
export function money(value: number | null | undefined, currency = 'INR'): string {
  if (value == null || Number.isNaN(value)) return '—';
  return (currency === 'INR' ? '₹' : currency + ' ') + inr.format(value);
}

export const dash = (value: string | number | null | undefined) =>
  value === null || value === undefined || value === '' ? '—' : String(value);

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso + 'T12:00:00Z');
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' }).toUpperCase();
}

export function initials(name: string | null | undefined): string {
  return (name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');
}
