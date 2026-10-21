import { Directory } from 'expo-file-system';
import { printToFileAsync } from 'expo-print';

export async function saveAndroidReport(format: 'csv' | 'pdf', filename: string, csv: string, html: string) {
  const folder = await Directory.pickDirectoryAsync();
  let contents = csv;
  if (format === 'pdf') {
    const result = await printToFileAsync({ html, base64: true });
    if (!result.base64) throw new Error('PDF generation returned no data. Please try again.');
    contents = result.base64;
  }
  const destination = folder.createFile(`${filename}.${format}`, format === 'pdf' ? 'application/pdf' : 'text/csv');
  try {
    // The modern API decodes base64 into bytes before writing to Android's
    // document provider. Never read or copy Print's temporary file URI.
    destination.write(contents, { encoding: format === 'pdf' ? 'base64' : 'utf8' });
  } catch {
    try { destination.delete(); } catch { /* Preserve the write failure. */ }
    throw new Error('Could not save to this folder. Please select another writable folder.');
  }
}
