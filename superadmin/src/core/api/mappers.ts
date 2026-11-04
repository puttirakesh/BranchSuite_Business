/** Helpers for mapping shared-backend enums and decimals into UI values. */
export function titleCase(value: string | null | undefined): string {
  if (!value) return '';
  const words = value.toLowerCase().replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export const toNumber = (value: string | number | null | undefined) => (value == null ? 0 : Number(value));
export const dateOnly = (value: string | null | undefined) => (value ? value.slice(0, 10) : null);
export const shortId = (id: string | null | undefined) => (id ? id.slice(0, 8) : 'Unknown');
