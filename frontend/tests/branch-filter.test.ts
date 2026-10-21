import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import ts from 'typescript';
const { isInBranch } = createRequire(import.meta.url)('../src/core/admin/branch-filter') as typeof import('../src/core/admin/branch-filter');

function scopeFixture() {
  const available = [{ id: 'north', name: 'North' }];
  const api = { defaults: { headers: { common: { Authorization: 'Bearer fixture-token' } } } };
  const session = { user: { id: 'owner' }, memberships: [{ companyId: 'company', companyName: 'Example', role: 'BUSINESS_OWNER', branches: [...available] }] };
  const source = readFileSync(new URL('../src/core/admin/scope.tsx', import.meta.url), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const scope: any = {};
  const deps: Record<string, unknown> = {
    react: {}, 'react/jsx-runtime': {}, 'react-native': { Platform: { OS: 'android' } },
    '../api/client': { api, getSessionApi: async () => session },
    './http': { apiErrorMessage: (error: Error) => error.message },
    './api': { branchesApi: { available: async () => [...available] } },
  };
  new Function('require', 'exports', output)((name: string) => {
    if (!(name in deps)) throw new Error(`Unexpected dependency: ${name}`);
    return deps[name];
  }, scope);
  return { available, api, scope };
}

test('branch selection validates fresh available branches, including newly added branches', async () => {
  const { scope, available } = scopeFixture();
  await scope.getAdminScope();
  available.push({ id: 'south', name: 'South' });
  await scope.selectAdminBranch('south');
  assert.equal((await scope.getAdminScope()).branchId, 'south');
  await assert.rejects(scope.selectAdminBranch('unavailable'), /do not have access/);
  assert.equal(scope.getSelectedBranchId(), 'south');
  await scope.selectAdminBranch(null);
  assert.equal((await scope.getAdminScope()).branchId, null);
});

test('a pending branch selection cannot overwrite a newer authentication session', async () => {
  const { scope, api } = scopeFixture();
  await scope.getAdminScope();
  const pending = scope.selectAdminBranch('north');
  api.defaults.headers.common.Authorization = 'Bearer another-session';
  await assert.rejects(pending, /workspace changed/);
  assert.equal(scope.getSelectedBranchId(), null);
});

test('All branches includes combined records; selected branches match IDs even when names are equal', () => {
  const rows = [{ branchId: 'north', branch: 'Main' }, { branchId: 'south', branch: 'Main' }, { branchId: null }];
  assert.equal(rows.filter(row => isInBranch(row, null)).length, 3);
  assert.deepEqual(rows.filter(row => isInBranch(row, 'south', 'Main')), [rows[1]]);
  assert.equal(isInBranch({ branch: 'South' }, 'south', 'South'), true);
  assert.equal(isInBranch({ branch: 'North' }, 'south', 'South'), false);
});

test('combined payroll retains separate salaries for the same employee in two branches', async () => {
  const branches = [{ id: 'north', name: 'North' }, { id: 'south', name: 'South' }];
  const source = readFileSync(new URL('../src/core/payroll.ts', import.meta.url), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const loaded: { readPayroll?: () => Promise<any[]> } = {};
  const deps: Record<string, unknown> = {
    './admin/available-branches': { getAvailableBranches: async () => branches },
    './admin/scope': { getAdminScope: async () => ({ companyId: 'company' }) },
    './admin/local': { dateOnly: (value: string) => value.slice(0, 10), toMoney: (value: unknown) => Number(value ?? 0) },
    './admin/salary': {},
    './admin/api': { payrollApi: {
      periods: async () => [], incentives: async () => [],
      salaries: async (_company: string, branchId: string) => [{ userId: 'same-person', branchId, effectiveFrom: '2020-01-01', effectiveTo: null,
        structure: { basicAmount: branchId === 'north' ? '10000' : '15000', components: [] } }],
    } },
  };
  new Function('require', 'exports', output)((name: string) => {
    if (!(name in deps)) throw new Error(`Unexpected dependency: ${name}`);
    return deps[name];
  }, loaded);
  const rows = await loaded.readPayroll!();
  assert.equal(rows.length, 2);
  assert.equal(rows.reduce((sum, row) => sum + row.gross, 0), 25000);
  assert.equal(rows.filter(row => isInBranch(row, 'south', 'South')).length, 1);
});
