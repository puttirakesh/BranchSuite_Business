// Generate a downloadable report without a popup or browser print dialog.
export async function buildReportPdf(title: string, headers: string[], rows: string[][]) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const margin = 12;
  const width = pdf.internal.pageSize.getWidth() - margin * 2;
  const bottom = pdf.internal.pageSize.getHeight() - margin;
  const cellWidth = width / Math.max(headers.length, 1);
  const printable = (value: string) => value.replace(/₹/g, 'INR ').replace(/[–—]/g, '-');
  let y = margin;
  const drawRow = (cells: string[], heading = false) => {
    pdf.setFont('helvetica', heading ? 'bold' : 'normal');
    pdf.setFontSize(8);
    const lines = headers.map((_, index) => pdf.splitTextToSize(printable(cells[index] ?? ''), cellWidth - 4) as string[]);
    const lineCount = Math.max(1, ...lines.map(cell => cell.length));
    let offset = 0;
    while (offset < lineCount) {
      if (y + 8 > bottom) newPage();
      pdf.setFont('helvetica', heading ? 'bold' : 'normal');
      pdf.setFontSize(8);
      const count = Math.min(lineCount - offset, Math.max(1, Math.floor((bottom - y - 4) / 4)));
      const height = count * 4 + 4;
      lines.forEach((cell, index) => {
        const x = margin + index * cellWidth;
        pdf.setDrawColor(220, 227, 237);
        if (heading) { pdf.setFillColor(242, 245, 252); pdf.rect(x, y, cellWidth, height, 'FD'); }
        else pdf.rect(x, y, cellWidth, height);
        pdf.setTextColor(32, 51, 79);
        pdf.text(cell.slice(offset, offset + count), x + 2, y + 5, { lineHeightFactor: 1.4 });
      });
      y += height;
      offset += count;
    }
  };
  const newPage = () => {
    pdf.addPage();
    y = margin;
    drawRow(headers, true);
  };
  pdf.setFontSize(14);
  const titleLines = pdf.splitTextToSize(printable(title), width) as string[];
  pdf.text(titleLines, margin, y + 5);
  y += titleLines.length * 6 + 5;
  pdf.setFontSize(9);
  pdf.text(`${rows.length} records`, margin, y);
  y += 6;
  drawRow(headers, true);
  rows.forEach(row => drawRow(row));
  return pdf;
}
