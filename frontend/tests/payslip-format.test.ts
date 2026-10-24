import assert from 'node:assert/strict';
import { test } from 'node:test';
import { amountInWords, createPayslipDocument, payslipHtml } from '../src/features/employee/payslip-pdf-content';
import { buildPayslipPdf } from '../src/features/employee/payslip-pdf.web';
import { normalizePayslip } from '../src/features/employee/payslips';

const payslip = normalizePayslip({
  id: 'sample-entry', currency: 'INR', basicAmount: '40000', grossAmount: '47000', deductionsAmount: '2000', netAmount: '45000',
  components: [
    { id: 'basic', name: 'Basic Salary', amount: '40000', kind: 'EARNING' },
    { id: 'allowance', name: 'Allowance', amount: '7000', kind: 'EARNING' },
    { id: 'deduction', name: 'Tax', amount: '2000', kind: 'DEDUCTION' },
  ],
  run: { status: 'APPROVED', period: { year: 2026, month: 10 } }, payment: null,
});
const identity = { company: 'Example Company', name: 'Sample Employee', employeeId: 'EMP-001', department: 'Sales', designation: 'Sales Executive', branch: 'Main' };

test('amount in words handles Indian groups, zero and fractional rupees', () => {
  assert.equal(amountInWords(45000, 'INR'), 'Rupees Forty Five Thousand Only');
  assert.equal(amountInWords(12345678.09, 'INR'), 'Rupees One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight and Nine Paise Only');
  assert.equal(amountInWords(0, 'INR'), 'Rupees Zero Only');
  assert.equal(amountInWords(0.75, 'INR'), 'Rupees Zero and Seventy Five Paise Only');
  assert.equal(amountInWords(1250000, 'USD'), 'USD One Million Two Hundred Fifty Thousand Only');
});

test('format uses published components once and omits unavailable profile details', () => {
  const doc = createPayslipDocument(payslip, { ...identity, department: 'Not assigned', designation: '' });
  assert.equal(doc.earnings.filter(item => item.name === 'Basic Salary').length, 1);
  assert.equal(doc.deductions.length, 1);
  assert.equal(doc.metadata.some(([label]) => label === 'Department'), false);
  assert.equal(doc.metadata.some(([label]) => label === 'Designation'), false);
  assert.match(doc.status, /awaiting payment/);
  const noBreakdown = createPayslipDocument({ ...payslip, components: [] }, identity);
  assert.deepEqual(noBreakdown.earnings.map(item => item.amount), [47000]);
  assert.deepEqual(noBreakdown.deductions.map(item => item.amount), [2000]);
});

test('mobile HTML escapes user data and contains professional sections without a print script', () => {
  const html = payslipHtml(payslip, { ...identity, name: '<script>alert(1)</script>', company: 'Example & Company' });
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(html.includes('Example &amp; Company'));
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('window.print'));
  assert.ok(!html.includes('Payslip reference:'));
  assert.ok(!html.includes('Computer-generated payslip'));
  for (const text of ['Earnings', 'Deductions', 'NET TAKE-HOME PAY', 'Rupees Forty Five Thousand Only', 'Payment details', 'awaiting payment']) assert.ok(html.includes(text));
});

test('regular payslip fits one A4 page with published totals and employee details', () => {
  const pdf = buildPayslipPdf(payslip, identity);
  assert.equal(pdf.getNumberOfPages(), 1);
  const output = pdf.output();
  assert.ok(!output.includes('Payslip reference:'));
  assert.ok(!output.includes('Computer-generated payslip'));
  for (const text of ['PAYSLIP', 'Sample Employee', 'Sales Executive', 'INR 47,000.00', 'INR 2,000.00', 'INR 45,000.00', 'Rupees Forty Five Thousand Only', 'Page 1 of 1']) assert.ok(output.includes(text), text);
});

test('long breakdowns continue across pages with headers and every component intact', () => {
  const components = Array.from({ length: 80 }, (_, index) => ({ id: String(index), name: `Earning ${index}`, kind: 'EARNING' as const, amount: 100 }));
  components[3].name = 'Long salary component '.repeat(400);
  const pdf = buildPayslipPdf({ ...payslip, components }, identity);
  assert.ok(pdf.getNumberOfPages() > 2);
  const output = pdf.output();
  for (const text of ['Earning 0', 'Earning 79', 'INR 45,000.00', 'Payment details']) assert.ok(output.includes(text), text);
  assert.ok(output.split('(Amount)').length - 1 >= pdf.getNumberOfPages() - 1);
});

test('company settings control branding, optional bank fields and paid days in preview/export data', () => {
  const companyIdentity = { ...identity, bankName: 'Example Bank', bankAccount: 'XXXX1234', bankIfsc: 'TEST0123456', pan: 'ABCDE1234F', settings: { address: 'Registered address', footer: 'Company payroll contact', accentColor: '#224466', showBankDetails: true, showIdentifiers: false, showDepartment: false } };
  const slip = { ...payslip, paidDays: 28.5, periodDays: 31 };
  const doc = createPayslipDocument(slip, companyIdentity);
  assert.equal(doc.palette.accent, '#224466');
  assert.ok(doc.metadata.some(([label, value]) => label === 'Bank account' && value === 'XXXX1234'));
  assert.ok(doc.metadata.some(([label, value]) => label === 'Paid days' && value === '28.5 / 31'));
  assert.ok(!doc.metadata.some(([label]) => label === 'PAN' || label === 'Department'));
  const html = payslipHtml(slip, companyIdentity), pdf = buildPayslipPdf(slip, companyIdentity).output();
  for (const value of ['Registered address', 'Company payroll contact', 'XXXX1234', '28.5 / 31']) { assert.ok(html.includes(value)); assert.ok(pdf.includes(value)); }
  assert.ok(createPayslipDocument(slip, { ...identity, legacy: true }).legacyNote.includes('not captured'));
});
