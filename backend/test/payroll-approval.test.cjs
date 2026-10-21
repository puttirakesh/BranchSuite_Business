require('reflect-metadata');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { PayrollService } = require('../src/modules/payroll/payroll.service');

const preparer = { id: 'preparer', tenantId: 'tenant', roles: ['BUSINESS_OWNER'] };
const approver = { id: 'approver', tenantId: 'tenant', roles: ['BUSINESS_ADMIN'] };

function fixture() {
  const periods = [null, 'DRAFT', 'CALCULATED', 'APPROVED', 'PAID'].map((status, index) => ({
    id: `period-${index}`, tenantId: 'tenant', companyId: 'company', branchId: 'branch',
    run: status ? { id: `run-${index}`, status, createdById: preparer.id } : null,
  }));
  let writes = 0;
  const prisma = {
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

test('a different authorized admin can approve only calculated payroll', async () => {
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
  await assert.rejects(service.approve(preparer, 'run-2'), /cannot approve their own run/);
  assert.equal(writes(), 0);
});
