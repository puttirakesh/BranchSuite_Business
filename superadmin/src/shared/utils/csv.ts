import { Platform, Share } from 'react-native';

function cell(value: unknown): string {
  const text = value == null ? '' : String(value);
  // Neutralise spreadsheet formula injection and quote every cell.
  const safe = /^[=+\-@]/.test(text) ? "'" + text : text;
  return '"' + safe.replace(/"/g, '""') + '"';
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map((row) => row.map(cell).join(',')).join('\r\n');
}

/** Web: downloads a file. Native: opens the share sheet with the CSV text. */
export async function exportCsv(filename: string, headers: string[], rows: unknown[][]) {
  const csv = toCsv(headers, rows);
  if (Platform.OS === 'web') {
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  await Share.share({ title: filename, message: csv });
}
