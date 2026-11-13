require('reflect-metadata');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { Prisma } = require('@prisma/client');
const { computeSalaryBreakdown, assertItemizedSalaryMatches, normalizeComponents, STATUTORY_DEDUCTIONS } = require('../src/modules/payroll/salary-breakdown');

const D = value => new Prisma.Decimal(value);
const status = code => error => error.getStatus() === code;

test('with no allowances Basic equals Monthly Gross (existing legacy behaviour) and nothing is invented', () => {
  const result = computeSalaryBreakdown({ monthlyGross: '30000' });
  assert.equal(result.basicAmount, '30000.00');
  assert.equal(result.allowancesTotal, '0.00');
  assert.equal(result.deductionsTotal, '0.00');
  assert.equal(result.estimatedNet, '30000.00');
  assert.deepEqual(result.components, []);
});

test('Gross = Basic + allowances; deductions are not part of gross; Net = Gross - deductions', () => {
  const result = computeSalaryBreakdown({ monthlyGross: '40000.50', components: [
    { code: 'hra', name: 'House Rent Allowance', kind: 'EARNING', amount: '10000' },
    { code: 'LOAN', name: 'Loan recovery', kind: 'DEDUCTION', amount: '1500.25' },
    { code: 'ZERO', name: 'Unused', kind: 'EARNING', amount: '0' },
  ] });
  assert.equal(result.basicAmount, '30000.50');
  assert.equal(result.allowancesTotal, '10000.00');
  assert.equal(result.deductionsTotal, '1500.25');
  assert.equal(result.estimatedNet, '38500.25');
  assert.deepEqual(result.components.map(item => item.code), ['HRA', 'LOAN'], 'codes are normalised and zero rows dropped');
  const reconstructed = D(result.basicAmount).add(result.allowancesTotal);
  assert.equal(reconstructed.toFixed(2), result.monthlyGross);
});

test('statutory deductions are reported as NOT_CONFIGURED, never as a zero liability', () => {
  const result = computeSalaryBreakdown({ monthlyGross: '25000' });
  assert.deepEqual(result.statutory.map(item => item.code), STATUTORY_DEDUCTIONS.map(item => item.code));
  for (const item of result.statutory) assert.equal(item.status, 'NOT_CONFIGURED');
  assert.equal(result.deductionsTotal, '0.00');
});

test('invalid inputs are rejected with 400', () => {
  const bad = [
    { monthlyGross: '0' },
    { monthlyGross: '1000', components: [{ code: 'HRA', name: 'HRA', kind: 'EARNING', amount: '1000' }] },
    { monthlyGross: '1000', components: [{ code: 'HRA', name: 'HRA', kind: 'EARNING', amount: '1200' }] },
    { monthlyGross: '1000', components: [{ code: 'LOAN', name: 'Loan', kind: 'DEDUCTION', amount: '1000.01' }] },
    { monthlyGross: '1000', components: [{ code: 'BASIC', name: 'Basic', kind: 'EARNING', amount: '1' }] },
    { monthlyGross: '1000', components: [{ code: 'INCENTIVE', name: 'Incentive', kind: 'EARNING', amount: '1' }] },
    { monthlyGross: '1000', components: [{ code: 'A', name: 'A', kind: 'EARNING', amount: '1' }, { code: 'a', name: 'A2', kind: 'EARNING', amount: '1' }] },
    { monthlyGross: '1000', components: [{ code: 'X', name: 'X', kind: 'BONUS', amount: '1' }] },
  ];
  for (const input of bad) assert.throws(() => computeSalaryBreakdown(input), status(400), JSON.stringify(input));
});

test('onboarding and revisions share one itemised-totals check', () => {
  const components = normalizeComponents([{ code: 'HRA', name: 'HRA', kind: 'EARNING', amount: '5000' }, { code: 'PF', name: 'PF', kind: 'DEDUCTION', amount: '1800' }]);
  assert.doesNotThrow(() => assertItemizedSalaryMatches({ gross: D('20000'), deductions: D('1800'), basicAmount: D('15000'), components }));
  assert.throws(() => assertItemizedSalaryMatches({ gross: D('20001'), deductions: D('1800'), basicAmount: D('15000'), components }), status(400));
  assert.throws(() => assertItemizedSalaryMatches({ gross: D('20000'), deductions: D('1799'), basicAmount: D('15000'), components }), status(400));
  assert.throws(() => assertItemizedSalaryMatches({ gross: D('0'), deductions: D('0'), basicAmount: D('0'), components: [] }), status(400));
});
