const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const axios = require('axios');

// Compile the production TS modules in memory; intercept only the HTTP transport.
function loadModule(name, mocks = {}, cache = new Map()) {
  const file = path.resolve(__dirname, '../src/features/workforce', `${name}.ts`);
  if (cache.has(file)) return cache.get(file);
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} }; cache.set(file, module.exports);
  const localRequire = specifier => {
    if (Object.hasOwn(mocks, specifier)) return mocks[specifier];
    if (specifier.startsWith('./')) return loadModule(specifier.slice(2), mocks, cache);
    return require(specifier);
  };
  new Function('require', 'module', 'exports', output)(localRequire, module, module.exports);
  return module.exports;
}
const { validate, payload, isDate, isTimestamp } = loadModule('validation');
const { resources } = loadModule('resources');
const { employeeStepFields, employeeErrorStep } = loadModule('employeeFlow');
const session = { accessToken: 'test-token', userId: 'user', scope: { tenantId: 'tenant-a', companyId: 'company-a', branchId: 'branch-a', branchName: 'Test branch' }, permissions: [] };

test('local attendance rejects impossible dates and reversed or malformed times', () => {
  const service = loadModule('localAttendanceLeave', { '@react-native-async-storage/async-storage': { __esModule: true, default: {} } });
  const values = { employeeId: 'sample-1', date: '2026-10-07', checkIn: '09:00', checkOut: '17:30', notes: '' };
  assert.deepEqual(service.validateAttendance(values), {});
  assert.equal(service.workedMinutes(values.checkIn, values.checkOut), 510);
  assert.equal(service.workedMinutes(values.checkIn, ''), null);
  assert.ok(service.validateAttendance({ ...values, date: '2026-02-30' }).date);
  assert.ok(service.validateAttendance({ ...values, checkOut: '08:00' }).checkOut);
  assert.ok(service.validateAttendance({ ...values, checkIn: '25:00' }).checkIn);
});

test('local leave validates required reason, range order and inclusive calendar days', () => {
  const service = loadModule('localAttendanceLeave', { '@react-native-async-storage/async-storage': { __esModule: true, default: {} } });
  const values = { employeeId: 'sample-1', type: 'ANNUAL', startDate: '2024-02-28', endDate: '2024-03-01', reason: 'Family event' };
  assert.deepEqual(service.validateLeave(values), {});
  assert.equal(service.leaveDays(values.startDate, values.endDate), 3);
  assert.ok(service.validateLeave({ ...values, endDate: '2024-02-27' }).endDate);
  assert.ok(service.validateLeave({ ...values, reason: '' }).reason);
});

test('attendance prevents duplicate employee dates while preserving edits and leave storage', async () => {
  const data = new Map();
  const storage = { getItem: async key => data.get(key) ?? null, setItem: async (key, value) => { data.set(key, value); } };
  const service = loadModule('localAttendanceLeave', { '@react-native-async-storage/async-storage': { __esModule: true, default: storage } });
  const record = { id: 'attendance-1', employeeId: 'sample-1', employeeName: 'rizwana', date: '2026-10-07', checkIn: '09:00', checkOut: null, status: 'CHECKED_IN' };
  await service.saveLocalAttendanceLeave('attendance', record);
  await assert.rejects(service.saveLocalAttendanceLeave('attendance', { ...record, id: 'attendance-2' }), /already recorded/);
  await service.saveLocalAttendanceLeave('attendance', { ...record, checkOut: '17:00', status: 'PRESENT' });
  assert.equal((await service.readLocalAttendanceLeave('attendance')).length, 1);
  assert.equal((await service.readLocalAttendanceLeave('attendance'))[0].checkOut, '17:00');
  assert.deepEqual(await service.readLocalAttendanceLeave('leave'), []);
});

test('local leave cancellation persists without generating approval', async () => {
  const data = new Map();
  const storage = { getItem: async key => data.get(key) ?? null, setItem: async (key, value) => { data.set(key, value); } };
  const mock = { '@react-native-async-storage/async-storage': { __esModule: true, default: storage } };
  const service = loadModule('localAttendanceLeave', mock);
  const request = { id: 'leave-1', employeeId: 'sample-2', employeeName: 'kavyasri', startDate: '2026-10-08', endDate: '2026-10-09', type: 'ANNUAL', reason: 'Personal', status: 'PENDING' };
  await service.saveLocalAttendanceLeave('leave', request);
  await service.saveLocalAttendanceLeave('leave', { ...request, status: 'CANCELLED' });
  const reloaded = loadModule('localAttendanceLeave', mock);
  assert.equal((await reloaded.readLocalAttendanceLeave('leave'))[0].status, 'CANCELLED');
});

test('local task saves survive reload and concurrent saves preserve both assignments', async () => {
  const values = new Map();
  const storage = { getItem: async key => values.get(key) ?? null, setItem: async (key, value) => { values.set(key, value); } };
  const service = loadModule('localTasks', { '@react-native-async-storage/async-storage': { __esModule: true, default: storage } });
  const task = { id: 'task-1', title: 'Follow up', type: 'TASK', assigneeId: 'sample-1', assigneeName: 'rizwana', dueDate: '2026-10-08', dueTime: '11:00', priority: 'NORMAL', description: '', createdAt: '2026-10-07T00:00:00Z' };
  await Promise.all([service.saveLocalTask(task), service.saveLocalTask({ ...task, id: 'task-2', assigneeName: 'kavyasri' })]);
  const reloaded = loadModule('localTasks', { '@react-native-async-storage/async-storage': { __esModule: true, default: storage } });
  assert.deepEqual((await reloaded.readLocalTasks()).map(item => item.id), ['task-2', 'task-1']);
});

test('a failed local task write rejects without claiming a saved assignment', async () => {
  const storage = { getItem: async () => null, setItem: async () => { throw new Error('Storage unavailable'); } };
  const service = loadModule('localTasks', { '@react-native-async-storage/async-storage': { __esModule: true, default: storage } });
  await assert.rejects(service.saveLocalTask({ id: 'task-1', title: 'Check documents', type: 'TASK', assigneeId: 'sample-1', assigneeName: 'rizwana', dueDate: '2026-10-08', dueTime: '11:00', priority: 'NORMAL', description: '', createdAt: '2026-10-07T00:00:00Z' }), /Storage unavailable/);
  assert.deepEqual(await service.readLocalTasks(), []);
});
function transport(response) {
  const calls = [];
  const api = { defaults: { baseURL: 'https://test.invalid/api/v1' }, request: async config => { calls.push(config); return { data: response }; } };
  return { calls, api, service: loadModule('api', { '../../services/api': { api } }) };
}

test('date validation rejects impossible dates and missing timezone', () => {
  assert.equal(isDate('2026-02-30'), false);
  assert.equal(isDate('2024-02-29'), true);
  assert.equal(isTimestamp('2026-10-07T09:00:00'), false);
  assert.equal(isTimestamp('2026-10-07T09:00:00+05:30'), true);
  assert.equal(isTimestamp('2026-02-30T09:00:00Z'), false);
});
test('leave and payroll reject reversed periods', () => {
  assert.ok(validate(resources.leave.fields, { employeeId: 'e', type: 'SICK', startDate: '2026-10-09', endDate: '2026-10-07', reason: 'Rest' }).endDate);
  assert.ok(validate(resources.payroll.fields, { name: 'October', periodStart: '2026-10-31', periodEnd: '2026-10-01', currency: 'INR' }).periodEnd);
});
test('attendance compares timestamps across timezone offsets', () => {
  assert.ok(validate(resources.attendance.fields, { employeeId: 'e', date: '2026-10-07', checkIn: '2026-10-07T09:00:00Z', checkOut: '2026-10-07T10:00:00+05:30' }).checkOut);
});
test('writes allow only editable fields, preserving decimal strings', () => {
  const result = payload(resources.employees.fields, { name: ' Jane ', tenantId: 'attacker', role: 'ADMIN', netPay: '9999', email: 'jane@example.com' });
  assert.equal(result.name, 'Jane');
  assert.equal(result.tenantId, undefined); assert.equal(result.role, undefined); assert.equal(result.netPay, undefined);
  assert.deepEqual(payload([{ key: 'amount', kind: 'money' }], { amount: '123456789012345678.10' }), { amount: '123456789012345678.10' });
});
test('required fields and enum values are validated before submission', () => {
  const errors = validate(resources.tasks.fields, { title: ' ', priority: 'ADMIN', status: 'TODO' });
  assert.ok(errors.title); assert.ok(errors.assigneeId); assert.ok(errors.priority);
});
test('employee form accepts a valid profile and an optional phone number', () => {
  const profile = { name: 'A', email: 'person@example.com', jobTitle: 'Engineer', department: 'Operations', startDate: '2026-10-07', status: 'ACTIVE', phone: '+91 (98765) 43210' };
  assert.deepEqual(validate(resources.employees.fields, profile), {});
  assert.deepEqual(validate(resources.employees.fields, { ...profile, phone: '' }), {});
});
test('employee form rejects invalid profile details without requiring salary fields', () => {
  const errors = validate(resources.employees.fields, {
    name: 'A'.repeat(121), email: 'bad-email', jobTitle: '', department: '',
    startDate: '2026-02-30', status: 'ADMIN', phone: 'call me tomorrow',
  });
  for (const field of ['name', 'email', 'jobTitle', 'department', 'startDate', 'status', 'phone']) assert.ok(errors[field], field);
  assert.equal(errors.salary, undefined);
});
test('employee onboarding validates the current step and catches remaining errors at final review', () => {
  const values = { name: 'Jane Doe', email: 'jane@example.com', phone: '', jobTitle: '', department: 'Operations', startDate: '2026-02-30', status: 'ACTIVE' };
  assert.deepEqual(validate(employeeStepFields(resources.employees.fields, 0), values), {});
  const employmentErrors = validate(employeeStepFields(resources.employees.fields, 1), values);
  assert.ok(employmentErrors.jobTitle); assert.ok(employmentErrors.startDate);
  assert.equal(employeeErrorStep(employmentErrors), 1);
  const reviewErrors = validate(resources.employees.fields, { ...values, email: 'invalid' });
  assert.equal(employeeErrorStep(reviewErrors), 0);
  assert.equal(employeeErrorStep({}), -1);
});
test('employee status filter combines with scoped search and pagination and is omitted for all', async () => {
  const { calls, service } = transport({ items: [], nextCursor: null });
  await service.listRecords(session, 'employees', 'Jane', 'next-page', undefined, 'INACTIVE');
  assert.deepEqual(calls[0].params, { search: 'Jane', limit: '25', cursor: 'next-page', status: 'INACTIVE' });
  assert.equal(calls[0].headers['X-Branch-Id'], 'branch-a');
  await service.listRecords(session, 'employees', ''); assert.equal(calls[1].params.status, undefined);
  await service.listRecords(session, 'payroll', '', undefined, undefined, 'ACTIVE'); assert.equal(calls[2].params.status, undefined);
});
test('every GET, POST, and PATCH includes authenticated scope', async () => {
  const { calls, service } = transport({ id: 'record' });
  for (const method of ['get', 'post', 'patch']) await service.request(session, method, '/employees', { data: { name: 'Jane' } });
  for (const call of calls) assert.deepEqual(call.headers, { Authorization: 'Bearer test-token', 'X-Tenant-Id': 'tenant-a', 'X-Company-Id': 'company-a', 'X-Branch-Id': 'branch-a' });
});
test('payroll remains under payroll endpoints and list pagination preserves cursor', async () => {
  const { calls, service } = transport({ items: [{ id: 'pay', name: 'October' }], nextCursor: null });
  await service.listRecords(session, 'payroll', 'October', 'cursor-a');
  assert.equal(calls[0].url, '/payroll/runs'); assert.equal(calls[0].params.cursor, 'cursor-a');
  await service.listRecords(session, 'payslips', 'Jane'); assert.equal(calls[1].url, '/payroll/payslips');
});
test('employee picker uses limited options with the originating permission context', async () => {
  const { calls, service } = transport({ items: [], nextCursor: null });
  await service.employeeOptions(session, 'leave', 'Jane');
  assert.equal(calls[0].url, '/employees/options'); assert.equal(calls[0].params.forResource, 'leave');
});
test('malformed API pages and details are rejected', async () => {
  const { service } = transport({ items: [{ name: 'Missing ID' }], nextCursor: null });
  await assert.rejects(service.listRecords(session, 'employees', ''), /unsupported response/);
  await assert.rejects(service.getRecord(session, 'employees', 'id'), /unsupported record/);
});
test('offline, expired session, forbidden, and conflict have distinct messages', () => {
  const { service } = transport(null);
  assert.equal(service.asWorkforceError(new axios.AxiosError('Network')).kind, 'offline');
  const failure = status => new axios.AxiosError('Error', undefined, undefined, undefined, { status });
  assert.equal(service.asWorkforceError(failure(401)).kind, 'auth');
  assert.equal(service.asWorkforceError(failure(403)).kind, 'forbidden');
  assert.match(service.asWorkforceError(failure(409)).message, /Refresh/);
});
test('missing service configuration stops requests before sending credentials', async () => {
  const { api, calls, service } = transport(null); api.defaults.baseURL = undefined;
  await assert.rejects(service.request(session, 'get', '/employees'), /not configured/); assert.equal(calls.length, 0);
});
test('login normalizes email and selects only a server-authorized scope', async () => {
  const scope = { tenantId: 't', companyId: 'c', companyName: 'Company', branchId: 'b', branchName: 'Branch', permissions: ['employees.read'] };
  const response = { accessToken: 'token', userId: 'user', scopes: [scope] };
  const calls = [];
  const service = loadModule('authApi', { '../../services/api': { api: { defaults: { baseURL: 'https://test.invalid' }, post: async (...args) => { calls.push(args); return { data: response }; } } } });
  const login = await service.login(' PERSON@EXAMPLE.COM ', 'test password');
  assert.deepEqual(calls[0], ['/auth/login', { email: 'person@example.com', password: 'test password' }]);
  assert.deepEqual(service.selectedSession(login, scope), { accessToken: 'token', userId: 'user', scope: { tenantId: 't', companyId: 'c', branchId: 'b', branchName: 'Branch', companyName: scope.companyName }, permissions: ['employees.read'] });
});
test('login reports incorrect credentials and rejects malformed branch permissions', async () => {
  const api = { defaults: { baseURL: 'https://test.invalid' }, post: async () => { throw new axios.AxiosError('Error', undefined, undefined, undefined, { status: 401 }); } };
  const service = loadModule('authApi', { '../../services/api': { api } });
  await assert.rejects(service.login('person@example.com', 'wrong'), /Email or password is incorrect/);
  api.post = async () => ({ data: { accessToken: 'token', userId: 'user', scopes: [{ permissions: 'ADMIN' }] } });
  await assert.rejects(service.login('person@example.com', 'wrong'), /unsupported session/);
});
test('branch reload checks authenticated identity and uses the bearer token', async () => {
  const calls = [];
  const api = { defaults: { baseURL: 'https://test.invalid' }, get: async (...args) => { calls.push(args); return { data: { userId: 'other-user', scopes: [] } }; } };
  const service = loadModule('authApi', { '../../services/api': { api } });
  await assert.rejects(service.availableScopes(session), /unsupported branch list/);
  assert.deepEqual(calls[0], ['/auth/me', { headers: { Authorization: 'Bearer test-token' } }]);
});
test('browser sessions survive reload and logout removes only this app session', async () => {
  const previous = global.window;
  const values = new Map([['unrelated', 'keep']]);
  global.window = { sessionStorage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) } };
  try {
    const storage = loadModule('sessionStorage.web');
    await storage.writeSession('branchsuite.session.v1', JSON.stringify(session));
    assert.deepEqual(JSON.parse(await storage.readSession('branchsuite.session.v1')), session);
    await storage.deleteSession('branchsuite.session.v1');
    assert.equal(await storage.readSession('branchsuite.session.v1'), null);
    assert.equal(values.get('unrelated'), 'keep');
    delete global.window;
    assert.equal(await storage.readSession('branchsuite.session.v1'), null);
  } finally { if (previous === undefined) delete global.window; else global.window = previous; }
});
test('browser cancellation does not perform a record action', () => {
  const previous = global.window;
  try {
    const { confirmAction } = loadModule('confirm.web');
    let count = 0;
    global.window = { confirm: () => false };
    confirmAction('Confirm', 'Change employee status?', 'Save', () => count++); assert.equal(count, 0);
    global.window.confirm = () => true;
    confirmAction('Confirm', 'Change employee status?', 'Save', () => count++); assert.equal(count, 1);
  } finally { if (previous === undefined) delete global.window; else global.window = previous; }
});
test('dashboard summary reflects employee statuses and groups department headcount', () => {
  const { summarizeEmployees } = loadModule('employeeDashboardModel');
  assert.deepEqual(summarizeEmployees([
    { id: 'a', status: 'ACTIVE', department: 'Engineering' }, { id: 'b', status: 'INACTIVE', department: 'Engineering' },
    { id: 'c', status: 'ACTIVE', department: 'HR' },
  ]), { total: 3, active: 2, inactive: 1, departments: [{ name: 'Engineering', count: 2 }, { name: 'HR', count: 1 }] });
  assert.deepEqual(summarizeEmployees([]), { total: 0, active: 0, inactive: 0, departments: [] });
});
test('live dashboard summary uses authenticated scope and validates consistent totals', async () => {
  const { calls, service } = transport({ total: 2, active: 1, inactive: 1, departments: [{ name: 'HR', count: 2 }] });
  const summary = await service.getEmployeeSummary(session); assert.equal(summary.total, 2);
  assert.equal(calls[0].url, '/employees/summary'); assert.equal(calls[0].headers['X-Branch-Id'], 'branch-a');
  const malformed = transport({ total: 5, active: 1, inactive: 1, departments: [] });
  await assert.rejects(malformed.service.getEmployeeSummary(session), /unsupported employee summary/);
});
