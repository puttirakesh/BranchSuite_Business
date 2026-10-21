import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildReportPdf } from '../src/core/admin/report-pdf';

test('report PDF produces a real PDF with paginated rows and repeated headers', async () => {
  const pdf = await buildReportPdf('Payroll summary', ['Employee', 'Amount'],
    Array.from({ length: 100 }, (_, index) => [`Employee ${index}`, 'INR 1000']));
  assert.ok(pdf.getNumberOfPages() > 1);
  const data = pdf.output();
  assert.ok(data.startsWith('%PDF-'));
  assert.ok(data.includes('Employee 99'));
  assert.ok(data.split('(Amount)').length - 1 >= pdf.getNumberOfPages());
});

test('long report cells continue onto later pages', async () => {
  const pdf = await buildReportPdf('Employee directory', ['Name', 'Notes'], [
    ['A teammate', 'Long note '.repeat(4000)], ['Final employee', 'Last record'],
  ]);
  assert.ok(pdf.getNumberOfPages() > 1);
  assert.ok(pdf.output().includes('Final employee'));
});
