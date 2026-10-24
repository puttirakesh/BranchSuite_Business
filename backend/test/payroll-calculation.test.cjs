const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Prisma } = require('@prisma/client');
const { calculateEmployeeSalary } = require('../src/modules/payroll/payroll-calculation.ts');
const D = value => new Prisma.Decimal(value);
const date = value => new Date(value + 'T00:00:00Z');
const salary = (from, to = null, basic = 31000) => ({ id: from, effectiveFrom: date(from), effectiveTo: to ? date(to) : null, basicOverride: null, structure: { currency: 'INR', basicAmount: D(basic), components: [{ code: 'TAX', name: 'Tax', kind: 'DEDUCTION', amount: D(3100) }] } });
const base = () => ({ salaries: [salary('2026-10-01')], start: date('2026-10-01'), end: date('2026-10-31'), attendanceBased: false, calendar: null, attendance: [], leaves: [], pendingCorrections: [], halfDayDeduction: '0.50', deductUnpaidLeave: true, deductAbsentDays: true });

test('joining, exit, and effective-dated salary revisions use calendar-day proration', () => {
  let result = calculateEmployeeSalary({ ...base(), joiningDate: date('2026-10-16') });
  assert.equal(result.gross.toFixed(2), '16000.00'); assert.equal(result.deductions.toFixed(2), '1600.00'); assert.equal(result.paidDays.toNumber(), 16);
  result = calculateEmployeeSalary({ ...base(), exitDate: date('2026-10-10') });
  assert.equal(result.gross.toFixed(2), '10000.00');
  result = calculateEmployeeSalary({ ...base(), salaries: [salary('2026-10-01', '2026-10-15'), salary('2026-10-16', null, 62000)], incentive: { amount: D(500), description: 'Sales incentive' } });
  assert.equal(result.gross.toFixed(2), '47500.00'); assert.equal(result.components.filter(item => item.code === 'BASIC').length, 1); assert.equal(result.paidDays.toNumber(), 31);
  assert.throws(() => calculateEmployeeSalary({ ...base(), salaries: [salary('2026-10-01'), salary('2026-10-16')] }), /overlap/);
});

test('attendance payroll reconciles weekly offs, holidays, leave, half days, and absences', () => {
  const input = { ...base(), attendanceBased: true, calendar: { weeklyOffDays: [0], holidays: ['2026-10-02'] }, attendance: [], leaves: [{ startDate: date('2026-10-05'), endDate: date('2026-10-05'), status: 'APPROVED', leaveType: { isPaid: false } }] };
  for (let day = 1; day <= 31; day++) {
    const value = '2026-10-' + String(day).padStart(2, '0');
    if ([2, 5].includes(day) || date(value).getUTCDay() === 0) continue;
    input.attendance.push({ attendanceDate: date(value), status: day === 6 ? 'HALF_DAY' : day === 7 ? 'ABSENT' : 'PRESENT', source: 'MANUAL', checkOutAt: null });
  }
  const result = calculateEmployeeSalary(input);
  assert.equal(result.paidDays.toNumber(), 28.5); assert.equal(result.gross.toFixed(2), '28500.00'); assert.equal(result.net.toFixed(2), '25650.00');
  assert.throws(() => calculateEmployeeSalary({ ...input, calendar: null }), /calendar/);
  assert.throws(() => calculateEmployeeSalary({ ...input, attendance: input.attendance.slice(1) }), /Missing or incomplete attendance/);
  assert.throws(() => calculateEmployeeSalary({ ...input, pendingCorrections: ['2026-10-06'] }), /pending leave or attendance/);
  assert.throws(() => calculateEmployeeSalary({ ...input, leaves: [...input.leaves, { startDate: date('2026-10-06'), endDate: date('2026-10-06'), status: 'PENDING', leaveType: { isPaid: true } }] }), /pending leave/);
});

test('partial month in leap February and payroll totals retain exact cents', () => {
  const assignment = salary('2028-02-01', null, 1000); assignment.structure.components = [];
  const result = calculateEmployeeSalary({ ...base(), start: date('2028-02-01'), end: date('2028-02-29'), salaries: [assignment], joiningDate: date('2028-02-20') });
  assert.equal(result.periodDays, 29); assert.equal(result.paidDays.toNumber(), 10);
  assert.equal(result.gross.toFixed(2), '344.83');
  assert.throws(() => calculateEmployeeSalary({ ...base(), salaries: [salary('2026-10-01', null, 1000)] }), /deductions exceed/);
});
