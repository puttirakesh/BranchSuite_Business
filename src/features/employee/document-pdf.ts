import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { File } from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import { employee, type EmployeeDocument } from './data';

export const sampleDocumentNotice = 'This is a generated sample document. No real employment or bank verification is asserted.';

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}

type PdfSaveHandle = {
  createWritable: () => Promise<{
    write: (data: Blob) => Promise<void>;
    close: () => Promise<void>;
    abort: () => Promise<void>;
  }>;
};

type PdfSavePicker = (options: {
  suggestedName: string;
  startIn: 'downloads';
  types: { description: string; accept: Record<string, string[]> }[];
}) => Promise<PdfSaveHandle>;

export function documentPdfFilename(document: EmployeeDocument) {
  const documentName = document.kind === 'Letter' ? 'Employment' : 'Bank_Verification';
  return `Sample_${documentName}_${employee.id}.pdf`;
}

async function createNamedNativePdf(html: string, filename: string) {
  const { uri } = await Print.printToFileAsync({ html });
  const generatedPdf = new File(uri);
  const namedPdf = new File(generatedPdf.parentDirectory, filename);
  try {
    if (namedPdf.exists) namedPdf.delete();
    generatedPdf.copy(namedPdf);
    return namedPdf;
  } finally {
    try { generatedPdf.delete(); } catch { /* Ignore temporary cache cleanup failures. */ }
  }
}

export async function saveDocumentPdf(document: EmployeeDocument) {
  const filename = documentPdfFilename(document);
  if (Platform.OS === 'web') {
    // Open the picker before loading the PDF library to preserve the click's user activation.
    const browserWindow = window as unknown as { showSaveFilePicker?: PdfSavePicker };
    let handle: PdfSaveHandle | undefined;
    if (browserWindow.showSaveFilePicker) {
      try {
        handle = await browserWindow.showSaveFilePicker({
          suggestedName: filename,
          startIn: 'downloads',
          types: [{ description: 'PDF document', accept: { 'application/pdf': ['.pdf'] } }],
        });
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
        throw error;
      }
    }
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF();
    pdf.setProperties({ title: filename });
    const blocks = [document.title, `${employee.name} - ${employee.id}`, sampleDocumentNotice, document.content];
    let y = 22;
    blocks.forEach((block, index) => {
      pdf.setFont('helvetica', index === 0 ? 'bold' : 'normal');
      pdf.setFontSize(index === 0 ? 18 : 11);
      const lines: string[] = pdf.splitTextToSize(block, 170);
      for (const line of lines) {
        if (y > 275) { pdf.addPage(); y = 22; }
        pdf.text(line, 20, y);
        y += index === 0 ? 9 : 6;
      }
      y += 8;
    });
    if (handle) {
      const writable = await handle.createWritable();
      try {
        await writable.write(pdf.output('blob'));
        await writable.close();
      } catch (error) {
        await writable.abort().catch(() => undefined);
        throw error;
      }
    } else {
      // Browsers without a save picker use their configured download location.
      pdf.save(filename);
    }
    return;
  }

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8" /><title>${escapeHtml(filename)}</title><style>body{font-family:Arial,sans-serif;padding:32px;color:#17263f}h1{font-size:24px}.notice{padding:16px;background:#eaf1ff;border-radius:12px}.content{white-space:pre-wrap;line-height:1.6}</style></head><body><h1>${escapeHtml(document.title)}</h1><p>${escapeHtml(employee.name)} &middot; ${escapeHtml(employee.id)}</p><p class="notice">${sampleDocumentNotice}</p><div class="content">${escapeHtml(document.content)}</div></body></html>`;
  if (Platform.OS === 'android') {
    const temporaryPdf = await createNamedNativePdf(html, filename);
    try {
      const result = await IntentLauncher.startActivityAsync('android.intent.action.CREATE_DOCUMENT', {
        category: 'android.intent.category.OPENABLE',
        type: 'application/pdf',
        extra: { 'android.intent.extra.TITLE': filename },
      });
      if (result.resultCode === IntentLauncher.ResultCode.Canceled) return;
      if (result.resultCode !== IntentLauncher.ResultCode.Success || !result.data) {
        throw new Error('The save location is unavailable.');
      }
      new File(result.data).write(await temporaryPdf.bytes());
    } finally {
      try { temporaryPdf.delete(); } catch { /* Temporary cache cleanup must not mask the save result. */ }
    }
    return;
  }
  if (await Sharing.isAvailableAsync()) {
    const namedPdf = await createNamedNativePdf(html, filename);
    try {
      await Sharing.shareAsync(namedPdf.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Save sample document PDF' });
    } finally {
      try { namedPdf.delete(); } catch { /* Ignore temporary cache cleanup failures. */ }
    }
  } else {
    await Print.printAsync({ html });
  }
}
