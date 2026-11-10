import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSalaryStructure, salaryStructureTotals } from '../src/core/payroll-structure';

test('builds monthly gross and take-home from named salary components', () => {
  const salary = parseSalaryStructure('30000', [
    { code: 'HRA', name: 'House Rent Allowance', kind: 'EARNING', amount: '10000' },
    { code: 'SPECIAL_ALLOWANCE', name: 'Special Allowance', kind: 'EARNING', amount: '5000' },
    { code: 'PF', name: 'Provident Fund', kind: 'DEDUCTION', amount: '1800' },
  ]);
  assert.equal(salary.gross, 45000);
  assert.equal(salary.deductions, 1800);
  assert.equal(salary.basicAmount, '30000.00');
  assert.deepEqual(salary.components.map(item => item.code), ['HRA', 'SPECIAL_ALLOWANCE', 'PF']);
});

test('rejects duplicate, reserved, malformed, and over-gross components', () => {
  assert.throws(() => parseSalaryStructure('1000', [
    { name: 'Meal Allowance', kind: 'EARNING', amount: '10' },
    { name: 'Meal-Allowance', kind: 'EARNING', amount: '20' },
  ]), /duplicates or uses a reserved/);
  assert.throws(() => parseSalaryStructure('1000', [
    { name: 'Incentive', kind: 'EARNING', amount: '10' },
  ]), /reserved payroll component code/);
  assert.throws(() => parseSalaryStructure('1000', [
    { name: 'Monthly deduction', kind: 'DEDUCTION', amount: '1000.01' },
  ]), /cannot exceed gross/);
  assert.throws(() => parseSalaryStructure('1.001', []), /Basic salary/);
});

test('shows live totals while component amounts are being entered', () => {
  assert.deepEqual(salaryStructureTotals('20000', [
    { name: 'HRA', kind: 'EARNING', amount: '5000' },
    { name: 'Tax', kind: 'DEDUCTION', amount: '1000' },
    { name: 'Empty', kind: 'EARNING', amount: '' },
  ]), { gross: 25000, deductions: 1000 });
});
