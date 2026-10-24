import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizePayslip, normalizePayslips, paymentStatusLabel } from '../src/features/employee/payslips';

const entry = {
  id: 'entry', currency: 'INR', basicAmount: '1000.00', grossAmount: '1200.00', deductionsAmount: '100.00', netAmount: '1100.00',
  components: [{ id: 'basic', name: 'Basic Salary', kind: 'EARNING', amount: '1000.00' }],
  run: { status: 'APPROVED', period: { year: 2026, month: 10 } }, payment: null,
};

test('individual payment is paid even while the rest of the run is approved', () => {
  const payslip = normalizePayslip({ ...entry, payment: { paidAt: '2026-10-05T09:00:00Z', method: 'BANK_TRANSFER', reference: 'REF-123' } });
  assert.equal(payslip.paid, true);
  assert.equal(payslip.netAmount, 1100);
  assert.equal(payslip.paymentMethod, 'BANK_TRANSFER');
  assert.equal(payslip.paymentReference, 'REF-123');
  assert.match(paymentStatusLabel(payslip), /^Paid on /);
  assert.equal(paymentStatusLabel(normalizePayslip(entry)), 'Approved - awaiting payment');
});

test('sorts salary history by payroll period rather than record creation order', () => {
  const older = { ...entry, id: 'older', run: { status: 'PAID', period: { year: 2025, month: 12 } } };
  assert.deepEqual(normalizePayslips([older, entry]).map(item => item.id), ['entry', 'older']);
  assert.equal(normalizePayslip(older).paid, true);
  assert.equal(normalizePayslip(older).paymentDate, null);
});

test('rejects malformed or unpublished payroll data instead of displaying invalid pay', () => {
  for (const netAmount of [null, undefined, '', ' ', true, [], {}, 'NaN', Infinity]) {
    assert.throws(() => normalizePayslip({ ...entry, netAmount }));
  }
  for (const status of ['DRAFT', 'CALCULATED']) {
    assert.throws(() => normalizePayslip({ ...entry, run: { ...entry.run, status } }));
  }
  assert.throws(() => normalizePayslips({ items: [entry] }));
  assert.throws(() => normalizePayslip({ ...entry, components: null }));
  assert.throws(() => normalizePayslip({ ...entry, run: { ...entry.run, period: { year: 2026, month: 13 } } }));
});
