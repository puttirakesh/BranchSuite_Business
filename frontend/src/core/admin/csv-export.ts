import { Platform } from 'react-native';

// Prefix formula-like cells so spreadsheets do not execute them.
export const csvCell = (value: string | number) => {
  const text = String(value);
  return `"${(/^[\s]*[=+@-]/.test(text) ? "'" + text : text).replace(/"/g, '""')}"`;
};

export const toCsv = (rows: (string | number)[][]) => '﻿' + rows.map(row => row.map(csvCell).join(',')).join('\r\n');

/** Downloads (web), saves to a chosen folder (Android) or shares (iOS) a CSV. Returns a user-facing notice. */
export async function exportCsv(filename: string, rows: (string | number)[][]): Promise<string> {
  const csv = toCsv(rows);
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return 'CSV download started.';
  }
  if (Platform.OS === 'android') {
    const { saveAndroidReport } = await import('./android-report-export');
    await saveAndroidReport('csv', filename, csv, '');
    return 'CSV saved to the selected folder.';
  }
  const { File, Paths } = await import('expo-file-system');
  const file = new File(Paths.cache, `${filename}.csv`);
  file.create({ overwrite: true });
  file.write(csv);
  const Sharing = await import('expo-sharing');
  if (!(await Sharing.isAvailableAsync())) throw new Error('File sharing is unavailable on this device.');
  await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text', dialogTitle: `Save ${filename}` });
  return 'Export ready. Choose where to save or share it.';
}
