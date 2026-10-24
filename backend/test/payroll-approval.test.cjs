require('reflect-metadata');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { PayrollService } = require('../src/modules/payroll/payroll.service');

const preparer = { id: 'preparer', tenantId: 'tenant', roles: ['BUSINESS_OWNER'] };
const approver = { id: 'approver', tenantId: 'tenant', roles: ['COMPANY_MANAGER'] };

function fixture() {
  const periods = [null, 'DRAFT', 'CALCULATED', 'APPROVED', 'PAID'].map((status, index) => ({
    id: `period-${index}`, tenantId: 'tenant', companyId: 'company', branchId: 'branch',
    run: status ? {
      id: `run-${index}`, status, createdById: preparer.id,
      publishedAt: status === 'PAID' ? new Date('2026-10-20T10:00:00Z') : null,
    } : null,
  }));
  let writes = 0;
  const prisma = {
    auditEvent: { findMany: async () => [] },
    company: { findFirst: async () => ({ id: 'company' }) },
    branch: { findFirst: async () => ({ id: 'branch' }) },
    userCompanyAccess: { findUnique: async () => ({ userId: approver.id }) },
    userBranchAccess: { findUnique: async () => ({ userId: approver.id }) },
    payrollPeriod: { findMany: async query => periods.map(period => ({
      ...period,
      run: period.run ? Object.fromEntries(Object.keys(query.include.run.select).map(key => [key, period.run[key]])) : null,
    })) },
    payrollRun: { findFirst: async () => ({ ...periods[2].run, companyId: 'company', branchId: 'branch' }) },
    $transaction: async () => { writes++; },
  };
  return { service: new PayrollService(prisma, {}), prisma, writes: () => writes };
}

test('payroll preparer sees no approval action, including after reloading periods', async () => {
  const { service } = fixture();
  for (let load = 0; load < 2; load++) {
    const periods = await service.listPeriods(preparer, 'company', 'branch');
    assert.equal(periods[0].run, null);
    assert.ok(periods.slice(1).every(period => period.run.canApprove === false));
  }
});

test('an assigned manager can approve only calculated payroll', async () => {
  const { service } = fixture();
  const periods = await service.listPeriods(approver, 'company', 'branch');
  assert.deepEqual(periods.map(period => period.run?.canApprove ?? false), [false, false, true, false, false]);
});

test('a different admin without branch access cannot receive approval eligibility', async () => {
  const { service, prisma } = fixture();
  prisma.userBranchAccess.findUnique = async () => null;
  await assert.rejects(service.listPeriods(approver, 'company', 'branch'), /Branch access denied/);
});

test('direct approval requests still reject the preparer without writing payroll', async () => {
  const { service, writes } = fixture();
  await assert.rejects(service.approve(preparer, 'run-2'), /manager.*approve payroll/);
  await assert.rejects(service.approve({ ...preparer, roles: ['BUSINESS_OWNER', 'COMPANY_MANAGER'] }, 'run-2'), /cannot approve their own run/);
  assert.equal(writes(), 0);
});

test('manager approval does not grant payroll preparation, publication or payment access', async () => {
  const { service, writes } = fixture();
  await assert.rejects(service.calculate(approver, 'period'), /prepare, publish or pay payroll/);
  await assert.rejects(service.publish(approver, 'run'), /prepare, publish or pay payroll/);
  await assert.rejects(service.recordPayment(approver, 'entry', { method: 'CASH' }), /prepare, publish or pay payroll/);
  assert.equal(writes(), 0);
});

test('period listings preserve publication state across administrators and reloads', async () => {
  const { service } = fixture();
  for (const user of [preparer, approver]) {
    for (let load = 0; load < 2; load++) {
      const periods = await service.listPeriods(user, 'company', 'branch');
      assert.equal(periods[3].run.publishedAt, null);
      assert.equal(periods[4].run.publishedAt.toISOString(), '2026-10-20T10:00:00.000Z');
      assert.equal(periods[4].run.canApprove, false);
    }
  }
});

test('publication still requires independent approval first', async () => {
  const { service, writes } = fixture();
  await assert.rejects(service.publish(preparer, 'run-2'), /Approve payroll before publishing/);
  assert.equal(writes(), 0);
});
