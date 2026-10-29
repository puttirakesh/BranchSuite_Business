require('reflect-metadata');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { requestCompany, assertCompanyScope } = require('../src/common/company-scope');
const { businessDateKey, businessToday } = require('../src/common/business-time');
const { assertPayrollOpen } = require('../src/common/payroll-input-lock');
const { JwtAuthGuard } = require('../src/modules/auth/gaurds/jwt-auth.guard');
const { EmployeesService } = require('../src/modules/employees/employees.service');
const { PayrollService } = require('../src/modules/payroll/payroll.service');
const { AttendanceService } = require('../src/modules/attendance/attendance.service');
const { AttendanceCorrectionsService } = require('../src/modules/attendance/attendance-corrections.service');
const { LeaveService } = require('../src/modules/leave/leave.service');
const { DealsService } = require('../src/modules/crm/deals.service');
const { QuotesService } = require('../src/modules/crm/quotes.service');
const status = code => error => error.getStatus() === code;
const owner = { id: 'owner', tenantId: 'tenant', companyId: 'company', roles: ['BUSINESS_OWNER'] };

test('company scope rejects conflicting header/body/query values', () => {
  for (const request of [
    { headers: { 'x-company-id': 'A' }, body: { companyId: 'B' } },
    { headers: { 'x-company-id': 'A' }, query: { companyId: 'B' } },
    { body: { companyId: 'A' }, query: { companyId: 'B' } },
  ]) assert.throws(() => requestCompany(request), status(403));
  assert.equal(requestCompany({ headers: { 'x-company-id': 'A' }, body: { companyId: 'A' } }), 'A');
});

test('HR in A cannot onboard in B using A header or an ID-only operation', async () => {
  const user = { id: 'staff', tenantId: 'tenant', status: 'ACTIVE', tokenVersion: 0, tenant: { status: 'ACTIVE' },
    roles: [{ companyId: 'A', role: { name: 'HR_MANAGER' } }, { companyId: 'B', role: { name: 'EMPLOYEE' } }], companyAccess: [{ companyId: 'A' }, { companyId: 'B' }] };
  const guard = new JwtAuthGuard({ verifyAsync: async () => ({ sub: 'staff', tenantId: 'tenant', tokenVersion: 0 }) }, { user: { findUnique: async () => user } });
  const request = { headers: { authorization: 'Bearer token', 'x-company-id': 'A' }, body: { companyId: 'B' } };
  const context = { switchToHttp: () => ({ getRequest: () => request }) };
  await assert.rejects(guard.canActivate(context), status(403));
  request.headers['x-company-id'] = 'B';
  await guard.canActivate(context);
  assert.deepEqual(request.authUser.roles, ['EMPLOYEE']);
  await assert.rejects(new EmployeesService({}, {}).onboard(request.authUser, {}), status(403));
  assert.throws(() => assertCompanyScope({ companyId: 'A' }, 'B'), status(403));
  const service = new EmployeesService({ employeeProfile: { findFirst: async () => ({ userId: 'staff', companyId: 'B' }) } }, {});
  await assert.rejects(service.get({ ...owner, companyId: 'A' }, 'profile-in-B'), status(403));
});

test('business dates use IST across midnight and year boundaries', () => {
  assert.equal(businessDateKey(new Date('2026-10-28T20:00:00Z')), '2026-10-29');
  assert.equal(businessDateKey(new Date('2026-12-31T18:30:00Z')), '2027-01-01');
  assert.equal(businessToday(new Date('2026-10-28T20:00:00Z')).toISOString(), '2026-10-29T00:00:00.000Z');
});

function employeeFixture(remaining = 0, responsibilities = {}) {
  const writes = [];
  const employee = { id: 'profile', companyId: 'company', branchId: 'branch', userId: 'staff', status: 'ACTIVE', employeeCode: 'E1', joiningDate: new Date('2020-01-01'), exitDate: null };
  const tx = {
    $queryRaw: async () => [], payrollRun: { findFirst: async () => null },
    branch: { count: async () => responsibilities.branches ?? 0 },
    task: { count: async () => responsibilities.tasks ?? 0 },
    leaveRequest: { count: async () => responsibilities.leaves ?? 0 },
    employeeProfile: { count: async () => responsibilities.reports ?? 0, update: async ({ data }) => { writes.push(['profile', data]); return { ...employee, ...data }; } },
    userRole: { count: async () => responsibilities.global ?? 0, deleteMany: async args => writes.push(['roles', args.where]) },
    userBranchAccess: { deleteMany: async args => writes.push(['branches', args.where]) },
    userCompanyAccess: { deleteMany: async args => writes.push(['companies', args.where]), count: async () => remaining },
    user: { update: async args => writes.push(['user', args.data]) },
  };
  tx.$transaction = async fn => fn(tx);
  const service = new EmployeesService(tx, { record: async () => {} });
  service.getScoped = async () => employee;
  return { service, tx, writes, employee };
}

test('exit revokes company access and sessions without deleting salary history', async () => {
  const f = employeeFixture();
  await f.service.changeStatus(owner, 'profile', { status: 'EXITED', exitDate: '2026-01-01' });
  assert.deepEqual(f.writes.find(([kind]) => kind === 'branches')[1], { userId: 'staff', branch: { companyId: 'company' } });
  assert.ok(f.writes.some(([kind, where]) => kind === 'roles' && where.companyId === 'company'));
  assert.deepEqual(f.writes.find(([kind]) => kind === 'user')[1], { tokenVersion: { increment: 1 }, status: 'INACTIVE' });
});

test('exit from one company preserves login and access in other companies', async () => {
  const f = employeeFixture(1);
  await f.service.changeStatus(owner, 'profile', { status: 'EXITED', exitDate: '2026-01-01' });
  assert.deepEqual(f.writes.find(([kind]) => kind === 'user')[1], { tokenVersion: { increment: 1 } });
  assert.ok(f.writes.filter(([kind]) => kind === 'roles').every(([, where]) => where.companyId === 'company'));
});

test('offboarding requires handover and cannot bypass rehire or self-account protections', async () => {
  for (const key of ['branches', 'tasks', 'leaves', 'reports', 'global']) {
    const f = employeeFixture(0, { [key]: 1 });
    await assert.rejects(f.service.changeStatus(owner, 'profile', { status: 'EXITED', exitDate: '2026-01-01' }), status(409));
    assert.equal(f.writes.length, 0);
  }
  const f = employeeFixture();
  f.employee.status = 'EXITED';
  await assert.rejects(f.service.changeStatus(owner, 'profile', { status: 'INACTIVE' }), status(409));
  await assert.rejects(f.service.changeStatus({ ...owner, id: 'staff' }, 'profile', { status: 'INACTIVE' }), status(400));
});

test('closed payroll blocks source changes, including backdated exit', async () => {
  const f = employeeFixture(); f.tx.payrollRun.findFirst = async () => ({ status: 'APPROVED' });
  await assert.rejects(f.service.changeStatus(owner, 'profile', { status: 'EXITED', exitDate: '2026-01-01' }), status(409));
  assert.equal(f.writes.length, 0);
  let query;
  await assert.rejects(assertPayrollOpen({ $queryRaw: async () => [], payrollRun: { findFirst: async args => { query = args; return { status: 'PAID' }; } } }, { tenantId: 'tenant', companyId: 'company', branchId: 'branch' }, new Date('2026-01-10')), status(409));
  assert.deepEqual(query.where.status.in, ['CALCULATED', 'APPROVED', 'PAID']);
  assert.equal(query.where.period.startDate.lte.toISOString(), '2026-01-10T00:00:00.000Z');
});

test('payroll selects earned salary by employment dates independently of login and access', async () => {
  const stop = new Error('CAPTURED_QUERY'); let where;
  const tx = { $queryRaw: async () => [], payrollPeriod: { findFirst: async () => ({ id: 'period', companyId: 'company', branchId: 'branch', startDate: new Date('2026-01-01'), endDate: new Date('2026-01-31'), run: null }) },
    employeeSalary: { findMany: async args => { where = args.where; throw stop; } } };
  const prisma = { payrollPeriod: tx.payrollPeriod, company: { findFirst: async () => ({}) }, branch: { findFirst: async () => ({}) }, $transaction: async fn => fn(tx) };
  const service = new PayrollService(prisma, {}); service.resolvePolicyForPeriod = async () => ({});
  await assert.rejects(service.calculate(owner, 'period'), error => error === stop);
  assert.equal(where.user.status, undefined);
  assert.equal(where.user.companyAccess, undefined);
  assert.equal(where.user.branchAccess, undefined);
  assert.equal(where.user.employeeProfiles.some.joiningDate.lte.toISOString(), '2026-01-31T00:00:00.000Z');
});

test('checkout finds the open shift across UTC midnight', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-29T00:30:00Z') });
  const row = { id: 'shift', attendanceDate: new Date('2026-10-29'), checkInAt: new Date('2026-10-28T23:30:00Z'), checkOutAt: null, status: 'PRESENT' };
  let changed;
  const tx = { $queryRaw: async () => [], payrollRun: { findFirst: async () => null }, attendance: {
    findFirst: async ({ where }) => { assert.equal(where.attendanceDate, undefined); return row; },
    updateMany: async args => { changed = args; return { count: 1 }; }, findUniqueOrThrow: async () => ({ ...row, totalMinutes: 60 }),
  } }; tx.$transaction = async fn => fn(tx);
  const service = new AttendanceService(tx); service.ensureScope = async () => {}; service.ensureEmployee = async () => {};
  await service.checkOut({ id: 'staff', tenantId: 'tenant', roles: ['EMPLOYEE'] }, { companyId: 'company', branchId: 'branch' });
  assert.equal(changed.where.attendanceDate.toISOString(), row.attendanceDate.toISOString());
  assert.equal(changed.data.totalMinutes, 60);
});

function correctionFixture() {
  let saved;
  const tx = { $queryRaw: async () => [], payrollRun: { findFirst: async () => null },
    user: { findFirst: async () => ({ id: 'staff' }), findMany: async () => [] },
    employeeProfile: { findFirst: async () => ({ id: 'profile' }) },
    attendance: { findFirst: async () => null },
    attendanceCorrectionRequest: { findFirst: async () => null, create: async ({ data }) => { saved = data; return data; } },
  }; tx.$transaction = async fn => fn(tx);
  const service = new AttendanceCorrectionsService(tx); service.ensureScope = async () => {};
  return { service, tx, saved: () => saved };
}

test('missed-shift requests remain pending without creating attendance before approval', async () => {
  const f = correctionFixture();
  await f.service.create({ id: 'staff', tenantId: 'tenant', roles: ['EMPLOYEE'] }, { companyId: 'company', branchId: 'branch', attendanceDate: '2026-01-10', requestedCheckInAt: '2026-01-10T03:30:00Z', requestedCheckOutAt: '2026-01-10T11:30:00Z', reason: 'Forgot check-in' });
  assert.equal(f.saved().attendanceId, undefined);
  assert.equal(f.saved().requestedAttendanceDate.toISOString(), '2026-01-10T00:00:00.000Z');
});

test('early morning correction timestamps belong to their IST business date', () => {
  const f = correctionFixture();
  assert.doesNotThrow(() => f.service.parseRequestedTimes({ requestedCheckInAt: '2026-01-09T20:30:00Z', requestedCheckOutAt: '2026-01-10T04:30:00Z' }, new Date('2026-01-10')));
  assert.throws(() => f.service.parseRequestedTimes({ requestedCheckInAt: '2026-01-08T20:30:00Z', requestedCheckOutAt: '2026-01-09T04:30:00Z' }, new Date('2026-01-10')), status(400));
});

test('new leave uses assigned manager and rejects alternative or missing approval routing', async () => {
  const tx = { employeeProfile: { findFirst: async () => ({ status: 'ACTIVE', reportingManagerId: 'assigned' }) } };
  const service = new LeaveService(tx); service.ensureScope = async () => {}; service.ensureEmployee = async () => {}; service.ensureLeaveType = async () => ({});
  await assert.rejects(service.apply({ id: 'staff', tenantId: 'tenant', roles: ['EMPLOYEE'] }, { companyId: 'company', branchId: 'branch', reportingToId: 'other' }), status(400));
  tx.employeeProfile.findFirst = async () => null;
  await assert.rejects(service.apply({ id: 'staff', tenantId: 'tenant', roles: ['EMPLOYEE'] }, { companyId: 'company', branchId: 'branch' }), status(400));
});

test('only managers can reopen closed deals and reopening records an audit reason', async () => {
  const events = []; const deal = { id: 'deal', companyId: 'company', branchId: 'branch', stage: 'LOST', updatedAt: new Date() };
  const tx = { deal: { updateMany: async ({ where, data }) => { assert.equal(where.stage, 'LOST'); assert.equal(data.stage, 'NEGOTIATION'); return { count: 1 }; }, findUniqueOrThrow: async () => ({ ...deal, stage: 'NEGOTIATION' }) }, dealStageHistory: { create: async args => events.push(args.data) }, dealIncentive: { findFirst: async () => null } };
  tx.$transaction = async fn => fn(tx);
  const service = new DealsService(tx, { record: async (_tx, event) => events.push(event) }); service.getAccessible = async () => deal;
  await assert.rejects(service.reopen({ ...owner, roles: ['SALES_MANAGER'] }, 'deal', 'Customer returned'), status(403));
  await assert.rejects(service.reopen(owner, 'deal', ' '), status(400));
  await service.reopen(owner, 'deal', 'Customer returned');
  assert.equal(events[0].reason, 'Customer returned'); assert.equal(events[1].action, 'DEAL_REOPENED');
});

test('reopening a Won deal cancels its unpaid incentive and is refused once payroll used it', async () => {
  const deal = { id: 'deal', companyId: 'company', branchId: 'branch', stage: 'WON', updatedAt: new Date() };
  const incentive = { id: 'incentive', companyId: 'company', branchId: 'branch', year: 2026, month: 10, status: 'APPROVED' };
  let cancelled = null; let calculatedRun = null;
  const tx = { deal: { updateMany: async () => ({ count: 1 }), findUniqueOrThrow: async () => ({ ...deal, stage: 'NEGOTIATION' }) },
    dealStageHistory: { create: async () => {} }, dealIncentive: { findFirst: async () => incentive, update: async args => { cancelled = args.data; } },
    payrollRun: { findFirst: async () => calculatedRun } };
  tx.$transaction = async fn => fn(tx);
  const service = new DealsService(tx, { record: async () => {} }); service.getAccessible = async () => deal;
  await service.reopen(owner, 'deal', 'Customer cancelled order');
  assert.equal(cancelled.status, 'CANCELLED');
  cancelled = null; calculatedRun = { id: 'run' };
  await assert.rejects(service.reopen(owner, 'deal', 'Customer cancelled order'), status(409));
  assert.equal(cancelled, null);
});

test('accepted quote completes its linked deal using the quote total and history', async () => {
  const quote = { id: 'quote', dealId: 'deal', status: 'ACCEPTED', version: 2, total: '4200.50', currency: 'INR' };
  let data;
  const tx = { quote: { findFirst: async () => quote }, deal: { findUniqueOrThrow: async () => ({ id: 'deal', companyId: 'company', branchId: 'branch', customerId: 'customer', stage: 'PROPOSAL', updatedAt: new Date() }), updateMany: async args => { data = args.data; return { count: 1 }; } }, dealStageHistory: { create: async () => {} } };
  tx.$transaction = async fn => fn(tx);
  const service = new QuotesService(tx, {}, { record: async () => {} }); service.accessible = async () => quote;
  await service.completeDeal(owner, 'quote');
  assert.equal(data.stage, 'WON'); assert.equal(data.amount, '4200.50'); assert.equal(data.currency, 'INR');
  tx.quote.findFirst = async () => null;
  await assert.rejects(service.completeDeal(owner, 'quote'), status(409));
});
