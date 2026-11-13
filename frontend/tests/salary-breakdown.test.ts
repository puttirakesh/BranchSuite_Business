import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { breakdownRequestComponents, displayComponentName, formatInr, isStatutoryComponent, isValidGross } from '../src/core/salary-breakdown';
import { initialSalaryComponents } from '../src/core/payroll-structure';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('monthly gross input accepts only positive money with up to two decimals', () => {
  for (const value of ['1', '30000', '30000.5', '30000.55', ' 25000 ']) assert.equal(isValidGross(value), true, value);
  for (const value of ['', '0', '0.00', '-5', '1e3', '12.345', 'abc', '1234567890123']) assert.equal(isValidGross(value), false, value);
});

test('only entered amounts are sent to the backend preview; blanks are never turned into zeros', () => {
  const sent = breakdownRequestComponents(initialSalaryComponents());
  assert.deepEqual(sent, []);
  const withAmounts = initialSalaryComponents().map(item => item.code === 'HRA' ? { ...item, amount: '10000' } : item.code === 'PROVIDENT_FUND' ? { ...item, amount: '1800.50' } : item);
  assert.deepEqual(breakdownRequestComponents(withAmounts).map(item => [item.code, item.kind, item.amount]), [['HRA', 'EARNING', '10000'], ['PROVIDENT_FUND', 'DEDUCTION', '1800.50']]);
});

test('seeded PF/ESI/PT/TDS rows are treated as statutory; legacy custom components are not', () => {
  const seeded = initialSalaryComponents();
  assert.deepEqual(seeded.filter(isStatutoryComponent).map(item => item.code), ['PROVIDENT_FUND', 'ESI', 'PROFESSIONAL_TAX', 'TDS']);
  assert.equal(isStatutoryComponent({ code: 'MONTHLY_DEDUCTION', name: 'Monthly deduction', kind: 'DEDUCTION', amount: '100' }), false);
  assert.equal(isStatutoryComponent({ code: 'PROVIDENT_FUND', name: 'PF', kind: 'EARNING', amount: '100' }), false);
  assert.equal(displayComponentName('Provident Fund (manual)'), 'Provident Fund');
  assert.equal(formatInr('1234.5'), '₹1,234.50');
});

test('Employee creation and Payroll editing use the shared breakdown editor and no manual add/remove rows', () => {
  for (const file of ['../app/admin/employees/create.tsx', '../app/admin/payroll/index.tsx']) {
    const source = read(file);
    assert.match(source, /SalaryBreakdownEditor/, file);
    assert.doesNotMatch(source, /SalaryStructureEditor/, file);
  }
  const editor = read('../src/ui/SalaryBreakdownEditor.tsx');
  assert.doesNotMatch(editor, /Add earning|Add deduction/);
  assert.match(editor, /Monthly gross salary/);
  assert.match(editor, /Not configured/);
  const create = read('../app/admin/employees/create.tsx');
  assert.doesNotMatch(create, /Creates the employee account/);
  assert.doesNotMatch(create, /Basic salary', `/, 'the review lists Monthly gross first, then the calculated basic');
});

test('the frontend does not own the gross split: no percentage-based salary rules exist in the editor', () => {
  const editor = read('../src/ui/SalaryBreakdownEditor.tsx');
  assert.doesNotMatch(editor, /\*\s*0\.\d|\d+\s*%|percent/i);
});
