require('reflect-metadata');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { LeaveService } = require('../src/modules/leave/leave.service');

function fixture(reportingToId = 'selected') {
  const request = { id: 'leave', tenantId: 'tenant', companyId: 'company', branchId: 'branch',
    userId: 'employee', reportingToId, status: 'PENDING', days: 2,
    leaveTypeId: 'type', startDate: new Date('2026-11-01'), leaveType: { isPaid: true } };
  const writes = [];
  const tx = {
    $queryRaw: async () => [],
    payrollRun: { findFirst: async () => null },
    notification: { create: async () => ({}) },
    leaveRequest: {
      findFirst: async () => ({ ...request }),
      updateMany: async ({ data }) => { writes.push(data); return { count: 1 }; },
      findUniqueOrThrow: async () => ({ ...request, ...writes.at(-1) }),
    },
    leaveBalance: {
      findUnique: async () => ({ id: 'balance', tenantId: 'tenant', companyId: 'company', allocatedDays: 12, usedDays: 0 }),
      update: async args => writes.push(args),
    },
    branch: { findFirst: async () => ({ id: 'branch' }) },
    userCompanyAccess: { findUnique: async () => ({ userId: 'selected' }) },
    userBranchAccess: { findUnique: async () => ({ userId: 'selected' }) },
  };
  tx.$transaction = async fn => fn(tx);
  return { service: new LeaveService(tx), tx, request, writes };
}
const actor = (id = 'selected', roles = ['HR_MANAGER']) => ({ id, tenantId: 'tenant', roles });
const status = code => error => error.getStatus() === code;

for (const decision of ['APPROVED', 'REJECTED']) {
  test(`only the selected manager can mark leave ${decision}`, async () => {
    const f = fixture();
    for (const reviewer of [actor('other'), actor('owner', ['BUSINESS_OWNER']), actor('admin', ['BUSINESS_ADMIN'])]) {
      await assert.rejects(f.service.review(reviewer, 'leave', decision, {}), status(403));
      assert.equal(f.writes.length, 0);
    }
    const result = await f.service.review(actor(), 'leave', decision, { note: ' Reviewed ' });
    assert.equal(result.reviewedById, 'selected');
    assert.equal(result.status, decision);
    assert.equal(result.reviewNote, 'Reviewed');
    assert.equal(f.writes.length, decision === 'APPROVED' ? 2 : 1);
  });
}

test('selected reviewer still needs manager role, branch access and cannot review self', async () => {
  for (const scenario of ['role', 'branch', 'self']) {
    const f = fixture(scenario === 'self' ? 'employee' : 'selected');
    if (scenario === 'branch') f.tx.userBranchAccess.findUnique = async () => null;
    const reviewer = scenario === 'role' ? actor('selected', ['EMPLOYEE']) : actor(scenario === 'self' ? 'employee' : 'selected');
    await assert.rejects(f.service.review(reviewer, 'leave', 'APPROVED', {}), status(403));
    assert.equal(f.writes.length, 0);
  }
});

test('requests without a selected manager retain scoped review and pending status checks', async () => {
  const f = fixture(null);
  await f.service.review(actor('other'), 'leave', 'REJECTED', {});
  f.request.status = 'APPROVED';
  await assert.rejects(f.service.review(actor(), 'leave', 'REJECTED', {}), status(409));
});

test('review rechecks the selected manager inside the transaction before deducting balance', async () => {
  const f = fixture();
  f.tx.$transaction = async fn => { f.request.reportingToId = 'other'; return fn(f.tx); };
  await assert.rejects(f.service.review(actor(), 'leave', 'APPROVED', {}), status(403));
  assert.equal(f.writes.length, 0);
});

test('reporting manager choices offer review-capable company-scoped roles', async () => {
  const f = fixture();
  f.tx.user = { findMany: async ({ where, select }) => {
    assert.deepEqual(where.roles.some.OR, [{ companyId: null, role: { name: { in: ['BUSINESS_OWNER', 'BUSINESS_ADMIN'] } } }, { companyId: 'company' }]);
    assert.deepEqual(where.roles.some.role.name.in, ['BUSINESS_OWNER', 'BUSINESS_ADMIN', 'COMPANY_MANAGER', 'BRANCH_MANAGER', 'HR_MANAGER']);
    assert.deepEqual(select.roles.where.OR, [{ companyId: null, role: { name: { in: ['BUSINESS_OWNER', 'BUSINESS_ADMIN'] } } }, { companyId: 'company' }]);
    return [{ id: 'manager', name: 'Manager', roles: [{ role: { name: 'HR_MANAGER' } }], employeeProfiles: [] }];
  } };
  const options = await f.service.reportingToOptions(actor('employee', ['EMPLOYEE']), 'company', 'branch');
  assert.equal(options[0].id, 'manager');
});
