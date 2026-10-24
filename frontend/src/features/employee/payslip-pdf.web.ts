import { jsPDF } from 'jspdf';
import { type EmployeePayslip } from './payslips';
import { createPayslipDocument, pdfMoney, type Identity, type PayslipExportResult } from './payslip-pdf-content';
export { payslipLines } from './payslip-pdf-content';
export type { PayslipExportResult } from './payslip-pdf-content';

// Keep jsPDF in the initial web module graph, including during Metro development.
export function buildPayslipPdf(payslip: EmployeePayslip, identity: Identity): jsPDF {
  const data = createPayslipDocument(payslip, identity);
  const colors = data.palette;
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  pdf.setProperties({ title: 'Payslip - ' + data.period, author: data.company });
  let y = 18;
  const text = (value: string, x: number, top: number, size = 10, bold = false, color = colors.ink, align: 'left' | 'right' = 'left') => {
    pdf.setFont('helvetica', bold ? 'bold' : 'normal');
    pdf.setFontSize(size); pdf.setTextColor(color);
    pdf.text(value, x, top, { align });
  };
  const wrap = (value: string, width: number, size = 10): string[] => {
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(size);
    return pdf.splitTextToSize(value, width);
  };
  const rule = (top: number) => { pdf.setDrawColor(colors.border); pdf.setLineWidth(0.25); pdf.line(18, top, 192, top); };
  const nextPage = () => {
    pdf.addPage();
    text('PAYSLIP / CONTINUED', 18, 22, 10, true, colors.accent);
    text(data.period, 192, 22, 10, true, colors.muted, 'right');
    rule(28); y = 38;
  };
  const ensure = (height: number) => { if (y + height > 270) nextPage(); };

  pdf.setFillColor(colors.accent); pdf.rect(18, 16, 174, 1.5, 'F');
  if (data.logo) pdf.addImage(data.logo, data.logo.startsWith('data:image/png') ? 'PNG' : 'JPEG', 18, 23, 14, 14);
  const companyX = data.logo ? 38 : 18;
  const companyLines = wrap(data.company, data.logo ? 92 : 112, 19);
  companyLines.forEach((line, index) => text(line, companyX, 29 + index * 7, 19, true));
  const companyBottom = 29 + (companyLines.length - 1) * 7;
  text('Employee salary statement', 18, companyBottom + 7, 9, false, colors.muted);
  text('PAYSLIP', 192, 28, 10, true, colors.accent, 'right');
  text(data.period, 192, 36, 12, true, colors.ink, 'right');
  y = Math.max(companyBottom + 14, 44);
  for (const line of wrap(data.address, 174, 9).filter(Boolean)) { text(line, 18, y, 9, false, colors.muted); y += 4.5; }
  if (data.address) y += 3;
  rule(y); y += 11;

  for (let index = 0; index < data.metadata.length; index += 2) {
    const fields = data.metadata.slice(index, index + 2);
    const values = fields.map(([, value]) => wrap(value, 80, 10));
    const height = Math.max(...values.map(value => value.length)) * 4.5 + 10;
    ensure(height);
    fields.forEach(([label], column) => {
      const x = 18 + column * 89;
      text(label, x, y, 8, false, colors.muted);
      values[column].forEach((line, row) => text(line, x, y + 6 + row * 4.5, 10, true));
    });
    y += height;
  }
  y += 2;
  const columns = [18, 72, 105, 159, 192];
  const tableHeader = () => {
    pdf.setFillColor(colors.ink); pdf.rect(18, y, 174, 11, 'F');
    text('Earnings', 22, y + 7, 9, true, '#FFFFFF');
    text('Amount', 101, y + 7, 9, true, '#FFFFFF', 'right');
    text('Deductions', 109, y + 7, 9, true, '#FFFFFF');
    text('Amount', 188, y + 7, 9, true, '#FFFFFF', 'right');
    y += 11;
  };
  ensure(24); tableHeader();
  const count = Math.max(data.earnings.length, data.deductions.length, 1);
  for (let index = 0; index < count; index++) {
    const earning = data.earnings[index], deduction = data.deductions[index];
    const cells = [earning?.name || '', earning ? pdfMoney(earning.amount, payslip.currency) : '', deduction?.name || (index === 0 ? 'No deductions' : ''), deduction ? pdfMoney(deduction.amount, payslip.currency) : index === 0 ? pdfMoney(0, payslip.currency) : ''];
    const lines = cells.map((cell, col) => wrap(cell, columns[col + 1] - columns[col] - 8, 9));
    const length = Math.max(...lines.map(cell => cell.length), 1);
    let offset = 0;
    while (offset < length) {
      let capacity = Math.floor((270 - y - 6) / 4.5);
      if (capacity < 1 || (offset === 0 && length <= 8 && length > capacity)) {
        nextPage(); tableHeader(); capacity = Math.floor((270 - y - 6) / 4.5);
      }
      const take = Math.min(length - offset, capacity), height = Math.max(11, take * 4.5 + 6);
      if (index % 2) { pdf.setFillColor(colors.light); pdf.rect(18, y, 174, height, 'F'); }
      lines.forEach((cell, col) => cell.slice(offset, offset + take).forEach((line, row) => {
        text(line, col % 2 ? columns[col + 1] - 4 : columns[col] + 4, y + 6 + row * 4.5, 9, false, colors.ink, col % 2 ? 'right' : 'left');
      }));
      pdf.setDrawColor(colors.border); pdf.line(105, y, 105, y + height);
      rule(y + height); y += height; offset += take;
    }
  }
  // Totals use the published entry amounts, rather than recalculating payroll.
  if (y + 13 > 270) { nextPage(); tableHeader(); }
  pdf.setFillColor(colors.light); pdf.rect(18, y, 174, 13, 'F');
  text('Gross earnings', 22, y + 8, 9, true);
  text(pdfMoney(payslip.grossAmount, payslip.currency), 101, y + 8, 9, true, colors.ink, 'right');
  text('Total deductions', 109, y + 8, 9, true);
  text(pdfMoney(payslip.deductionsAmount, payslip.currency), 188, y + 8, 9, true, colors.ink, 'right');
  y += 23;

  const words = wrap(data.words, 158, 9);
  const netHeight = 28 + words.length * 4.5;
  ensure(netHeight);
  pdf.setFillColor(colors.pale); pdf.rect(18, y, 174, netHeight, 'F');
  pdf.setFillColor(colors.accent); pdf.rect(18, y, 1.2, netHeight, 'F');
  text('NET TAKE-HOME PAY', 24, y + 8, 9, true, colors.accent);
  text(pdfMoney(payslip.netAmount, payslip.currency), 24, y + 20, 22, true, colors.accent);
  words.forEach((line, index) => text(line, 24, y + 28 + index * 4.5, 9, false, colors.muted));
  y += netHeight + 12;
  ensure(15); text('Payment details', 18, y, 10, true); y += 8;
  for (const [label, value] of data.payment) {
    const lines = wrap(value, 125, 9);
    for (let index = 0; index < lines.length; index++) {
      ensure(6);
      if (index === 0) text(label, 18, y, 9, false, colors.muted);
      text(lines[index], 65, y, 9); y += 5;
    }
    y += 2;
  }
  for (const line of wrap(data.legacyNote, 174, 8).filter(Boolean)) { ensure(5); text(line, 18, y, 8, false, colors.muted); y += 4; }
  for (const line of wrap(data.footer, 174, 9).filter(Boolean)) { ensure(6); text(line, 18, y, 9, false, colors.muted); y += 5; }
  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    pdf.setPage(page); rule(279);
    text('Page ' + page + ' of ' + pages, 192, 285, 8, false, colors.muted, 'right');
  }
  return pdf;
}

export async function savePayslipPdf(payslip: EmployeePayslip, identity: Identity): Promise<PayslipExportResult> {
  buildPayslipPdf(payslip, identity).save('Payslip_' + payslip.year + '_' + String(payslip.month).padStart(2, '0') + '.pdf');
  return 'downloaded';
}
