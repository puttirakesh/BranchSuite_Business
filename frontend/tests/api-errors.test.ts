import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import ts from 'typescript';

const load = createRequire(import.meta.url);
function moduleFixture(file: string, dependencies: Record<string, unknown>): any {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  const result = {};
  new Function('require', 'exports', output)((name: string) => {
    if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
    return dependencies[name];
  }, result);
  return result;
}
const http = moduleFixture('../src/core/admin/http.ts', { axios: load('axios') });
const failure = (status: number, message: unknown) => ({ isAxiosError: true, response: { status, data: { message } } });

test('API errors hide missing-route URLs and technical identifier validation', () => {
  const routeError = http.apiErrorMessage(failure(404, 'Cannot GET /api/v1/payroll/incentives?companyId=private-id'));
  assert.match(routeError, /service.*unavailable/i);
  assert.doesNotMatch(routeError, /GET|api\/v1|private-id/);
  const uuidError = http.apiErrorMessage(failure(400, 'Validation failed (uuid v4 is expected)'));
  assert.match(uuidError, /refresh/i);
  assert.doesNotMatch(uuidError, /uuid/i);
  assert.equal(http.apiErrorMessage(failure(400, 'Request failed at http://internal.example/private'), 'Could not load payroll.'), 'Could not load payroll.');
});

test('API errors retain useful form validation and prioritize authentication and server status', () => {
  assert.equal(http.apiErrorMessage(failure(400, ['Enter a valid email.', 'Amount must be positive.'])), 'Enter a valid email. Amount must be positive.');
  assert.match(http.apiErrorMessage(failure(401, 'Cannot GET /private')), /sign in again/i);
  assert.match(http.apiErrorMessage(failure(403, 'Internal permission codes')), /permission/i);
  assert.equal(http.apiErrorMessage(failure(404, 'Lead not found')), 'Lead not found');
  assert.doesNotMatch(http.apiErrorMessage(failure(500, 'Prisma query failed at /database/private')), /Prisma|database/);
  assert.match(http.apiErrorMessage({ isAxiosError: true }), /connection/i);
});

test('CRM lead history reads the backend array without assuming pagination', async () => {
  const entries = [{ id: 'history-entry', kind: 'edit', note: 'Updated contact' }];
  const requests: unknown[] = [];
  const api = moduleFixture('../src/core/admin/api.ts', {
    '../api/client': { api: { get: async (path: string, config: unknown) => { requests.push({ path, config }); return { data: entries }; } } },
    './http': http,
  });
  assert.deepEqual(await api.leadsApi.history('company-id'), entries);
  assert.deepEqual(requests, [{ path: '/leads/history', config: { params: { companyId: 'company-id' } } }]);
});

test('overlapping branch reads share a request without caching completed results or crossing sessions', async () => {
  const pending: { resolve: (value: unknown) => void; reject: (cause: unknown) => void }[] = [];
  const client = { defaults: { headers: { common: { Authorization: 'Bearer first-session' } } }, get: () => new Promise((resolve, reject) => pending.push({ resolve, reject })) };
  const api = moduleFixture('../src/core/admin/api.ts', { '../api/client': { api: client }, './http': http });
  const first = api.branchesApi.available('company');
  assert.equal(api.branchesApi.available('company'), first);
  const otherCompany = api.branchesApi.available('other-company');
  client.defaults.headers.common.Authorization = 'Bearer second-session';
  const otherSession = api.branchesApi.available('company');
  assert.equal(pending.length, 3);
  pending.forEach(request => request.resolve({ data: [] }));
  await Promise.all([first, otherCompany, otherSession]);
  const fresh = api.branchesApi.available('company');
  assert.equal(pending.length, 4);
  pending[3].reject(failure(503, 'Temporary outage'));
  await assert.rejects(fresh);
  const retry = api.branchesApi.available('company');
  assert.equal(pending.length, 5);
  pending[4].resolve({ data: [] });
  assert.deepEqual(await retry, []);
});
