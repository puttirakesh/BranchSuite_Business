require('reflect-metadata');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { workingLeaveDays } = require('../src/modules/leave/leave-days');
const { lateMinutes } = require('../src/common/shift');
const { assertPlanCapacity } = require('../src/common/plan-limits');
const { PayrollService } = require('../src/modules/payroll/payroll.service');
const { EmployeesService } = require('../src/modules/employees/employees.service');
const { LeadsService } = require('../src/modules/crm/leads.service');

const status = code => error => error.getStatus?.() === code;
const owner = { id: 'owner', tenantId: 'tenant', roles: ['BUSINESS_OWNER'] };

test('leave counts working days only, using company weekly offs and holidays', () => {
  const calendar = { weeklyOffDays: [0, 6], holidays: ['2026-11-02'] };
  // Fri 30 Oct to Mon 2 Nov: Sat/Sun are weekly offs and Monday is a holiday.
  assert.equal(workingLeaveDays(new Date('2026-10-30'), new Date('2026-11-02'), calendar), 1);
  assert.equal(workingLeaveDays(new Date('2026-10-31'), new Date('2026-11-01'), calendar), 0);
  // Without a configured calendar every day counts, as before.
  assert.equal(workingLeaveDays(new Date('2026-10-30'), new Date('2026-11-02'), null), 4);
});

test('late minutes use the branch shift in business time and respect grace', () => {
  const branch = { shiftStart: '09:00', graceMinutes: 10 };
  assert.equal(lateMinutes(branch, new Date('2026-10-29T03:35:00Z')), 0); // 09:05 IST, within grace
  assert.equal(lateMinutes(branch, new Date('2026-10-29T03:50:00Z')), 20); // 09:20 IST
  assert.equal(lateMinutes(branch, new Date('2026-10-29T03:00:00Z')), 0); // 08:30 IST, early
  assert.equal(lateMinutes({ shiftStart: null, graceMinutes: 0 }, new Date('2026-10-29T06:00:00Z')), 0);
});

function planDb(planId, usage) {
  return {
    businessSubscription: { findUnique: async () => (planId ? { planId } : null) },
    company: { count: async () => usage.companies },
    branch: { count: async () => usage.branches },
    employeeProfile: { count: async () => usage.employees },
    user: { count: async () => usage.users },
  };
}

test('plan limits block additions over the plan and ignore tenants without a plan', async () => {
  const full = { companies: 1, branches: 2, employees: 75, users: 5 };
  for (const resource of ['companies', 'branches', 'employees', 'users'])
    await assert.rejects(assertPlanCapacity(planDb('starter', full), 'tenant', resource), /Upgrade your plan/);
  await assertPlanCapacity(planDb('growth', full), 'tenant', 'branches');
  await assertPlanCapacity(planDb(null, full), 'tenant', 'branches');
});

function paymentFixture({ payment = null, profile = { bankEnding: '1234', bankVerifiedAt: new Date() }, entries = 1 } = {}) {
  const writes = { created: [], updated: [], runPaid: 0, audit: [] };
  const entry = { id: 'entry', runId: 'run', userId: 'staff', netAmount: '1000.00', run: { id: 'run', status: 'APPROVED', companyId: 'company', branchId: 'branch' }, payment };
  const prisma = {
    company: { findFirst: async () => ({ id: 'company' }) },
    branch: { findFirst: async () => ({ id: 'branch' }) },
    employeeProfile: { findFirst: async () => profile },
    payrollEntry: { findFirst: async () => entry, findUniqueOrThrow: async () => entry, count: async () => entries },
    payrollRun: { findUniqueOrThrow: async () => entry.run, updateMany: async () => { writes.runPaid++; return { count: 1 }; } },
    payrollPayment: {
      create: async ({ data }) => { writes.created.push(data); entry.payment = { id: 'payment', ...data }; return entry.payment; },
      updateMany: async ({ data }) => { writes.updated.push(data); Object.assign(entry.payment, data); return { count: 1 }; },
      findUniqueOrThrow: async () => entry.payment,
      count: async () => (entry.payment?.status === 'CONFIRMED' ? 1 : 0),
    },
  };
  prisma.$transaction = async fn => fn(prisma);
  const service = new PayrollService(prisma, { record: async (_tx, event) => writes.audit.push(event.action) });
  return { service, writes, entry };
}

test('bank transfers need verified bank details', async () => {
  await assert.rejects(paymentFixture({ profile: { bankEnding: '1234', bankVerifiedAt: null } }).service.recordPayment(owner, 'entry', { method: 'BANK_TRANSFER' }), /Verify the employee's bank details/);
  await assert.rejects(paymentFixture({ profile: null }).service.recordPayment(owner, 'entry', { method: 'BANK_TRANSFER' }), /Add the employee's bank details/);
  const { service, writes } = paymentFixture({ profile: null });
  await service.recordPayment(owner, 'entry', { method: 'CASH' });
  assert.equal(writes.created[0].status, 'CONFIRMED');
});

test('processing payments settle the run only once confirmed; failures can be retried', async () => {
  const { service, writes, entry } = paymentFixture();
  await service.recordPayment(owner, 'entry', { method: 'BANK_TRANSFER', status: 'PROCESSING' });
  assert.equal(writes.runPaid, 0);
  await assert.rejects(service.recordPayment(owner, 'entry', { method: 'BANK_TRANSFER' }), /already marked as paid/);
  await assert.rejects(service.failPayment(owner, 'entry', ' '), status(400));
  await service.failPayment(owner, 'entry', 'Account closed');
  assert.equal(entry.payment.status, 'FAILED');
  await assert.rejects(service.confirmPayment(owner, 'entry'), /Only a processing payment/);
  await service.recordPayment(owner, 'entry', { method: 'UPI', reference: 'UTR123' });
  assert.equal(entry.payment.status, 'CONFIRMED');
  assert.deepEqual(writes.updated.at(-1).attempts, { increment: 1 });
  assert.equal(writes.runPaid, 1);
  assert.deepEqual(writes.audit, ['PAYMENT_RECORDED', 'PAYMENT_FAILED', 'PAYMENT_RETRIED']);
});

test('the payment file includes only payable entries with verified bank details', async () => {
  const people = [
    { userId: 'ok', employeeCode: 'EMP001', bankName: 'SBI', bankIfsc: 'SBIN0000001', bankEnding: '1111', bankVerifiedAt: new Date() },
    { userId: 'unverified', employeeCode: 'EMP002', bankIfsc: 'SBIN0000001', bankEnding: '2222', bankVerifiedAt: null },
    { userId: 'nobank', employeeCode: 'EMP003' },
  ];
  const entries = ['ok', 'unverified', 'nobank', 'paid'].map(userId => ({ id: userId, userId, netAmount: '500', user: { name: userId },
    payment: userId === 'paid' ? { status: 'CONFIRMED' } : null }));
  const prisma = { company: { findFirst: async () => ({ id: 'company' }) }, branch: { findFirst: async () => ({ id: 'branch' }) },
    payrollRun: { findFirst: async () => ({ id: 'run', status: 'APPROVED', companyId: 'company', branchId: 'branch', period: { year: 2026, month: 10 }, entries }) },
    employeeProfile: { findMany: async () => people } };
  const file = await new PayrollService(prisma, {}).paymentFile(owner, 'run');
  assert.equal(file.reference, 'SAL-2026-10');
  assert.deepEqual(file.rows.map(row => [row.employeeId, row.bankAccount, row.amount]), [['EMP001', 'XXXX1111', '500.00']]);
  assert.deepEqual(file.excluded.map(row => row.reason), ['Bank details not verified', 'Bank details missing']);
});

test('deal incentives need an independent reviewer and an open payroll month', async () => {
  const incentive = { id: 'inc', companyId: 'company', branchId: 'branch', year: 2026, month: 10, createdById: 'creator', userId: 'seller' };
  let run = null; let reviewed = null;
  const prisma = { company: { findFirst: async () => ({ id: 'company' }) }, branch: { findFirst: async () => ({ id: 'branch' }) },
    dealIncentive: { findFirst: async () => incentive, updateMany: async ({ data }) => { reviewed = data; return { count: 1 }; }, findUniqueOrThrow: async () => incentive },
    payrollPeriod: { findFirst: async () => (run ? { run } : null) }, notification: { create: async () => {} } };
  prisma.$transaction = async fn => fn(prisma);
  const service = new PayrollService(prisma, { record: async () => {} });
  await assert.rejects(service.reviewDealIncentive({ ...owner, id: 'creator' }, 'inc', true), /created an incentive cannot review/);
  await assert.rejects(service.reviewDealIncentive({ ...owner, id: 'seller' }, 'inc', true), /your own incentive/);
  await assert.rejects(service.reviewDealIncentive(owner, 'inc', false), /reason for rejecting/);
  run = { status: 'CALCULATED' };
  await assert.rejects(service.reviewDealIncentive(owner, 'inc', true), /already calculated/);
  run = null;
  await service.reviewDealIncentive(owner, 'inc', true);
  assert.equal(reviewed.status, 'APPROVED');
});

test('bank details must be verified by someone other than the person who entered them', async () => {
  const profile = { id: 'profile', userId: 'staff', companyId: 'company', branchId: 'branch', employeeCode: 'EMP001', bankEnding: '1234', bankIfsc: 'SBIN0000001', bankVerifiedAt: null, bankChangedById: 'hr' };
  let verified = null;
  const prisma = { employeeProfile: { findFirst: async () => profile, updateMany: async ({ data }) => { verified = data; return { count: 1 }; }, findUniqueOrThrow: async () => profile } };
  prisma.$transaction = async fn => fn(prisma);
  const service = new EmployeesService(prisma, { record: async () => {} });
  await assert.rejects(service.verifyBank({ ...owner, id: 'hr' }, 'profile'), /entered these bank details/);
  await assert.rejects(service.verifyBank({ ...owner, id: 'staff' }, 'profile'), /your own bank details/);
  await assert.rejects(service.verifyBank({ id: 'sales', tenantId: 'tenant', roles: ['SALES_MANAGER'] }, 'profile'), status(403));
  await service.verifyBank(owner, 'profile');
  assert.equal(verified.bankVerifiedById, 'owner');
});

test('bulk lead assignment validates every lead before changing any', async () => {
  const leads = { a: { id: 'a', name: 'A', stage: 'NEW', companyId: 'company', branchId: 'branch' }, b: { id: 'b', name: 'B', stage: 'WON', companyId: 'company', branchId: 'branch' } };
  const updated = [];
  const prisma = { lead: { update: async ({ where }) => updated.push(where.id) } };
  prisma.$transaction = async fn => fn(prisma);
  const service = new LeadsService(prisma, { record: async () => {} });
  service.checkLeadAccess = async (_user, id) => leads[id];
  service.checkAssignee = async () => {};
  await assert.rejects(service.bulkAssign(owner, ['a', 'b'], 'seller'), /Won lead "B"/);
  assert.deepEqual(updated, []);
  assert.deepEqual(await service.bulkAssign(owner, ['a', 'a'], 'seller'), { updated: 1 });
  assert.deepEqual(updated, ['a']);
});
