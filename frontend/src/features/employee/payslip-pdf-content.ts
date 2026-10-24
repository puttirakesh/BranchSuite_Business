import { type EmployeePayslip, paymentStatusLabel, periodLabel } from './payslips';

export type Identity = {
  name: string; employeeId: string; company: string;
  branch?: string; department?: string; designation?: string;
  companyId?: string; bankName?: string; bankAccount?: string; bankIfsc?: string; pan?: string; uan?: string;
  settings?: import('../../core/payroll-settings').PayslipSettings; settingsVersion?: number; legacy?: boolean;
};
export type PayslipExportResult = 'downloaded' | 'saved' | 'shared' | 'cancelled';

export const payslipPalette = { ink: '#17263F', muted: '#607086', accent: '#11786D', pale: '#EDF7F4', border: '#DCE5E9', light: '#F5F7FA' };
export const pdfMoney = (amount: number, currency: string) => `${currency} ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const small = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
function integerWords(value: number, indian: boolean): string {
  if (value < 20) return small[value];
  if (value < 100) return `${tens[Math.floor(value / 10)]}${value % 10 ? ` ${small[value % 10]}` : ''}`;
  const groups: [number, string][] = indian
    ? [[10000000, 'Crore'], [100000, 'Lakh'], [1000, 'Thousand'], [100, 'Hundred']]
    : [[1000000000000, 'Trillion'], [1000000000, 'Billion'], [1000000, 'Million'], [1000, 'Thousand'], [100, 'Hundred']];
  const [size, label] = groups.find(([size]) => value >= size)!;
  return `${integerWords(Math.floor(value / size), indian)} ${label}${value % size ? ` ${integerWords(value % size, indian)}` : ''}`;
}

export function amountInWords(amount: number, currency: string): string {
  const minor = Math.round(Math.abs(amount) * 100);
  if (!Number.isSafeInteger(minor)) return '';
  const whole = Math.floor(minor / 100), fraction = minor % 100;
  return `${amount < 0 ? 'Minus ' : ''}${currency === 'INR' ? 'Rupees' : currency} ${integerWords(whole, currency === 'INR')}${fraction ? ` and ${integerWords(fraction, false)} ${currency === 'INR' ? 'Paise' : 'Hundredths'}` : ''} Only`;
}

export function createPayslipDocument(payslip: EmployeePayslip, identity: Identity) {
  const optional = (value?: string) => value?.trim() && !/^Not (assigned|available)$/i.test(value.trim()) ? value.trim() : '';
  const earnings = payslip.components.filter(item => item.kind === 'EARNING');
  const deductions = payslip.components.filter(item => item.kind === 'DEDUCTION');
  const settings = identity.settings ?? {};
  const accent = /^#[0-9a-f]{6}$/i.test(settings.accentColor ?? '') ? settings.accentColor! : payslipPalette.accent;
  return {
    palette: { ...payslipPalette, accent },
    address: settings.address || '', logo: settings.logoDataUrl || '', footer: settings.footer || '',
    legacyNote: identity.legacy ? 'Legacy payslip: identity details were not captured when issued; current company records are shown.' : '',
    company: optional(identity.company) || 'Company',
    period: periodLabel(payslip.month, payslip.year),
    status: payslip.paid ? 'Paid' : 'Approved - awaiting payment',
    metadata: [
      ['Employee name', identity.name || 'Employee'], ['Employee ID', identity.employeeId || 'Not provided'],
      ...([['Department', settings.showDepartment !== false ? optional(identity.department) : ''], ['Designation', settings.showDesignation !== false ? optional(identity.designation) : ''], ['Branch', settings.showBranch !== false ? optional(identity.branch) : ''],
        ['Paid days', settings.showPaidDays !== false && payslip.paidDays !== undefined ? String(payslip.paidDays) + ' / ' + payslip.periodDays : ''],
        ['Bank name', settings.showBankDetails ? optional(identity.bankName) : ''], ['Bank account', settings.showBankDetails ? optional(identity.bankAccount) : ''], ['IFSC', settings.showBankDetails ? optional(identity.bankIfsc) : ''],
        ['PAN', settings.showIdentifiers ? optional(identity.pan) : ''], ['UAN', settings.showIdentifiers ? optional(identity.uan) : ''],
      ]).filter(([, value]) => value),
    ],
    earnings: earnings.length ? earnings : [{ id: 'gross', name: 'Gross earnings', amount: payslip.grossAmount }],
    deductions: deductions.length ? deductions : payslip.deductionsAmount > 0 ? [{ id: 'deductions', name: 'Total deductions', amount: payslip.deductionsAmount }] : [],
    words: amountInWords(payslip.netAmount, payslip.currency),
    payment: [
      ['Payment status', paymentStatusLabel(payslip)],
      ...(payslip.paymentMethod ? [['Payment method', payslip.paymentMethod.replace(/_/g, ' ')]] : []),
      ...(payslip.paymentReference ? [['Payment reference', payslip.paymentReference]] : []),
    ],
  };
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);

export function payslipHtml(payslip: EmployeePayslip, identity: Identity): string {
  const doc = createPayslipDocument(payslip, identity);
  const money = (amount: number) => escapeHtml(pdfMoney(amount, payslip.currency));
  const rows = Array.from({ length: Math.max(doc.earnings.length, doc.deductions.length, 1) }, (_, index) => {
    const earning = doc.earnings[index], deduction = doc.deductions[index];
    return `<tr><td>${earning ? escapeHtml(earning.name) : ''}</td><td class="amount">${earning ? money(earning.amount) : ''}</td><td>${deduction ? escapeHtml(deduction.name) : index === 0 ? 'No deductions' : ''}</td><td class="amount">${deduction ? money(deduction.amount) : index === 0 ? money(0) : ''}</td></tr>`;
  }).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Payslip - ${escapeHtml(doc.period)}</title><style>
  @page{size:A4;margin:18mm}*{box-sizing:border-box}body{font:12px Arial,sans-serif;color:${doc.palette.ink};margin:0}header{border-top:5px solid ${doc.palette.accent};padding:22px 0 18px;border-bottom:1px solid ${doc.palette.border}}h1{font-size:24px;margin:0 0 6px;overflow-wrap:anywhere}h2{font-size:12px;letter-spacing:2px;color:${doc.palette.accent};margin:0 0 8px}.muted{color:${doc.palette.muted}}.period{font-size:16px;font-weight:bold}.header-layout{width:100%;border-collapse:collapse}.header-layout td:last-child{text-align:right;width:35%}.header-layout td{padding:0;vertical-align:top}.meta{display:table;width:100%;padding:20px 0}.field{display:inline-block;vertical-align:top;width:50%;padding:0 12px 14px 0;overflow-wrap:anywhere}.label{display:block;color:${doc.palette.muted};font-size:10px;margin-bottom:5px}.value{font-weight:bold;font-size:12px}.salary{width:100%;border-collapse:collapse;table-layout:fixed;margin-bottom:20px}.salary th{background:${doc.palette.ink};color:white;text-align:left;padding:12px 10px;font-size:11px}.salary td{padding:12px 10px;border-bottom:1px solid ${doc.palette.border};vertical-align:top;overflow-wrap:anywhere}.salary th:nth-child(2),.salary th:nth-child(4){width:24%}.salary .amount{text-align:right;white-space:nowrap}.salary td:nth-child(3),.salary th:nth-child(3){border-left:1px solid ${doc.palette.border}}.salary tbody tr:nth-child(even){background:${doc.palette.light}}.salary tfoot td{font-weight:bold;background:${doc.palette.light}}thead{display:table-header-group}tfoot{display:table-row-group}tr{break-inside:avoid}.net{background:${doc.palette.pale};border-left:4px solid ${doc.palette.accent};padding:18px;margin-bottom:22px;break-inside:avoid}.net-title{font-size:11px;font-weight:bold;letter-spacing:1px;color:${doc.palette.accent}}.net-amount{font-size:27px;font-weight:bold;color:${doc.palette.accent};margin:8px 0}.words{color:${doc.palette.muted};font-size:11px;line-height:1.5}.payment{break-inside:avoid}.payment h3{font-size:12px;margin:0 0 12px}.payment p{margin:7px 0;overflow-wrap:anywhere}.payment span{display:inline-block;min-width:120px;color:${doc.palette.muted}}.reference{font-size:10px;overflow-wrap:anywhere;margin-top:18px}footer{border-top:1px solid ${doc.palette.border};margin-top:24px;padding-top:12px;font-size:10px;color:${doc.palette.muted};text-align:center}
  </style></head><body><header><table class="header-layout"><tr><td>${doc.logo ? `<img alt="Company logo" src="${escapeHtml(doc.logo)}" style="max-width:70px;max-height:48px;margin-bottom:10px" />` : ''}<h1>${escapeHtml(doc.company)}</h1>${doc.address ? `<p class="muted" style="white-space:pre-wrap">${escapeHtml(doc.address)}</p>` : ''}<span class="muted">Employee salary statement</span></td><td><h2>PAYSLIP</h2><div class="period">${escapeHtml(doc.period)}</div></td></tr></table></header>
  <section class="meta">${doc.metadata.map(([label, value]) => `<div class="field"><span class="label">${escapeHtml(label)}</span><span class="value">${escapeHtml(value)}</span></div>`).join('')}</section>
  <table class="salary"><thead><tr><th>Earnings</th><th class="amount">Amount</th><th>Deductions</th><th class="amount">Amount</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td>Gross earnings</td><td class="amount">${money(payslip.grossAmount)}</td><td>Total deductions</td><td class="amount">${money(payslip.deductionsAmount)}</td></tr></tfoot></table>
  <section class="net"><div class="net-title">NET TAKE-HOME PAY</div><div class="net-amount">${money(payslip.netAmount)}</div><div class="words">${escapeHtml(doc.words)}</div></section>
  <section class="payment"><h3>Payment details</h3>${doc.payment.map(([label, value]) => `<p><span>${escapeHtml(label)}</span> ${escapeHtml(value)}</p>`).join('')}</section>${doc.legacyNote ? `<p class="muted">${escapeHtml(doc.legacyNote)}</p>` : ''}${doc.footer ? `<footer>${escapeHtml(doc.footer)}</footer>` : ''}</body></html>`;
}

export function payslipLines(payslip: EmployeePayslip, identity: Identity): string[] {
  // PDF's standard fonts support currency codes consistently across platforms.
  const amount = (value: number) => `${payslip.currency} ${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return [
    `Salary slip - ${periodLabel(payslip.month, payslip.year)}`,
    identity.company,
    `Employee: ${identity.name}`,
    `Employee ID: ${identity.employeeId}`,
    `Status: ${payslip.paid ? 'Paid' : 'Approved'}`,
    ...payslip.components.map(item => `${item.name} (${item.kind === 'EARNING' ? 'Earning' : 'Deduction'}): ${amount(item.amount)}`),
    `Basic salary: ${amount(payslip.basicAmount)}`,
    `Gross earnings: ${amount(payslip.grossAmount)}`,
    `Total deductions: ${amount(payslip.deductionsAmount)}`,
    `Net take-home pay: ${amount(payslip.netAmount)}`,
    paymentStatusLabel(payslip),
    ...(payslip.paymentMethod ? [`Payment method: ${payslip.paymentMethod.replace(/_/g, ' ')}`] : []),
    ...(payslip.paymentReference ? [`Reference: ${payslip.paymentReference}`] : []),
  ].filter(Boolean);
}

