import { Platform } from 'react-native';
import { type EmployeePayslip } from './payslips';
import { payslipHtml, type Identity, type PayslipExportResult } from './payslip-pdf-content';
export { payslipLines } from './payslip-pdf-content';
export type { PayslipExportResult } from './payslip-pdf-content';

export async function savePayslipPdf(payslip: EmployeePayslip, identity: Identity): Promise<PayslipExportResult> {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
    throw new Error('Native PDF export is only available on Android and iOS.');
  }
  const filename = `Payslip_${payslip.year}_${String(payslip.month).padStart(2, '0')}.pdf`;
  const html = payslipHtml(payslip, identity);
  if (Platform.OS === 'android') {
    const { saveAndroidReport } = await import('../../core/admin/android-report-export');
    try {
      await saveAndroidReport('pdf', filename.replace(/\.pdf$/, ''), '', html);
      return 'saved';
    } catch (error) {
      const code = (error as { code?: string } | null)?.code;
      if (code === 'ERR_PICKER_CANCELLED' || code === 'ERR_CANCELED' ||
        (error instanceof Error && /picker was cancel(?:led|ed) by the user/i.test(error.message))) return 'cancelled';
      // Keep actionable write errors, while hiding native module rejection details.
      if (error instanceof Error && /^(Could not save to this folder|PDF generation returned no data)/.test(error.message)) throw error;
      throw new Error('Could not save your payslip. Try again and select a writable folder.');
    }
  }
  const Sharing = await import('expo-sharing');
  if (!await Sharing.isAvailableAsync()) throw new Error('PDF sharing is unavailable on this device. Open My payroll in a browser to download.');
  const Print = await import('expo-print');
  const result = await Print.printToFileAsync({ html, base64: true });
  if (!result.base64) throw new Error('The PDF could not be generated. Please try again.');
  const { File, Paths } = await import('expo-file-system');
  // Write the PDF bytes into an app-owned file, rather than sharing Print's
  // temporary URI, which may not be readable by the native sharing provider.
  const file = new File(Paths.cache, filename);
  try {
    file.create({ overwrite: true });
    file.write(result.base64, { encoding: 'base64' });
  } catch {
    try { file.delete(); } catch { /* Preserve the file preparation error. */ }
    throw new Error('Could not prepare your payslip PDF. Please try downloading again.');
  }
  try {
    await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: filename });
    return 'shared';
  } catch {
    throw new Error('Could not open the share sheet. Close any open share sheet and try downloading again.');
  } finally {
    try { file.delete(); } catch { /* Sharing outcome takes precedence over cache cleanup. */ }
  }
}
