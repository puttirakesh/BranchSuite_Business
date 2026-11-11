// Reactivation must consume plan capacity exactly like creation does (mocked Prisma).
require('reflect-metadata');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { CompaniesService } = require('../src/modules/companies/companies.service');
const { EmployeesService } = require('../src/modules/employees/employees.service');
const { UsersService } = require('../src/modules/users/users.service');

const owner = { id: 'owner', tenantId: 'tenant', roles: ['BUSINESS_OWNER'] };
const isLimit = (resource, limit) => (error) => {
  assert.equal(error.getStatus(), 403);
  assert.equal(error.getResponse().code, 'PLAN_LIMIT_REACHED');
  assert.equal(error.getResponse().resource, resource);
  assert.equal(error.getResponse().limit, limit);
  return true;
};

// A transaction double exposing only the usage counters and an active plan.
function txWith(plan, usage, extra = {}) {
  const locks = [];
  const tx = {
    $executeRaw: async (strings, ...values) => { locks.push(values[0]); return 1; },
    $queryRaw: async () => [],
    businessSubscription: { findUnique: async () => ({ planId: plan }) },
    company: { count: async () => usage.companies ?? 0, ...extra.company },
    branch: { count: async () => usage.branches ?? 0, ...extra.branch },
    employeeProfile: { count: async () => usage.employees ?? 0, ...extra.employeeProfile },
    user: { count: async () => usage.users ?? 0, ...extra.user },
    auditEvent: { create: async () => ({}) },
  };
  tx.$transaction = async (fn) => fn(tx);
  return { tx, locks };
}

test('reactivating a company is refused at the company limit and allowed below it', async () => {
  const { tx, locks } = txWith('starter', { companies: 1 }, { company: { updateMany: async () => ({ count: 1 }) } });
  const service = new CompaniesService({ ...tx, company: { ...tx.company, findFirst: async () => ({ id: 'c1', status: 'INACTIVE' }) }, $transaction: tx.$transaction });
  service.findOne = async () => ({ id: 'c1' });
  await assert.rejects(service.updateStatus(owner, 'c1', 'ACTIVE'), isLimit('companies', 1));
  assert.deepEqual(locks, ['plan-capacity:tenant']);

  const below = txWith('growth', { companies: 2 }, { company: { updateMany: async () => ({ count: 1 }) } });
  const ok = new CompaniesService({ ...below.tx, company: { ...below.tx.company, findFirst: async () => ({ id: 'c1', status: 'INACTIVE' }) }, $transaction: below.tx.$transaction });
  ok.findOne = async () => ({ id: 'c1' });
  await ok.updateStatus(owner, 'c1', 'ACTIVE');
});

test('deactivating a company never consumes capacity', async () => {
  const { tx, locks } = txWith('starter', { companies: 1 }, { company: { updateMany: async () => ({ count: 1 }) }, branch: { count: async () => 0 } });
  const service = new CompaniesService({ ...tx, company: { ...tx.company, findFirst: async () => ({ id: 'c1', status: 'ACTIVE' }) }, branch: tx.branch, $transaction: tx.$transaction });
  service.findOne = async () => ({ id: 'c1' });
  await service.updateStatus(owner, 'c1', 'INACTIVE');
  assert.equal(locks.length, 0);
});

test('reactivating an employee is refused at the employee limit (all three plans)', async () => {
  for (const [plan, limit] of [['starter', 75], ['growth', 250], ['scale', 1000]]) {
    const { tx } = txWith(plan, { employees: limit });
    const service = new EmployeesService(tx, { record: async () => undefined });
    service.getScoped = async () => ({ id: 'e1', userId: 'staff', companyId: 'c1', branchId: 'b1', status: 'INACTIVE', exitDate: null, joiningDate: new Date('2020-01-01') });
    await assert.rejects(service.changeStatus({ ...owner, roles: ['BUSINESS_OWNER'] }, 'e1', { status: 'ACTIVE' }), isLimit('employees', limit), plan);
  }
});

test('reactivating a staff user with a business role is refused at the staff-user limit; employees take no seat', async () => {
  const scoped = (roleName, usersCount) => {
    const { tx } = txWith('starter', { users: usersCount }, {
      user: {
        count: async () => usersCount,
        findFirst: async () => ({ id: 'u1', status: 'INACTIVE', roles: [{ role: { name: roleName } }] }),
        updateMany: async () => ({ count: 1 }),
      },
      branch: { count: async () => 0 },
    });
    const service = new UsersService({ ...tx, $transaction: tx.$transaction }, { record: async () => undefined });
    service.assertCompanyAccess = async () => undefined;
    service.findOne = async () => ({ id: 'u1' });
    return service;
  };
  await assert.rejects(scoped('HR_MANAGER', 5).changeStatus(owner, 'u1', 'ACTIVE', 'company-1'), isLimit('users', 5));
  // Below the limit: allowed.
  await scoped('HR_MANAGER', 4).changeStatus(owner, 'u1', 'ACTIVE', 'company-1');
  // A plain employee never holds a staff-user seat, even when the plan is full.
  await scoped('EMPLOYEE', 5).changeStatus(owner, 'u1', 'ACTIVE', 'company-1');
});

test('capacity checks for different tenants lock different keys (tenant-scoped usage)', async () => {
  const { assertPlanCapacity } = require('../src/common/plan-limits');
  const seen = [];
  const db = (tenant) => ({
    $executeRaw: async (_s, key) => { seen.push(key); return 1; },
    businessSubscription: { findUnique: async ({ where }) => { assert.equal(where.tenantId, tenant); return { planId: 'scale' }; } },
    company: { count: async ({ where }) => { assert.equal(where.tenantId, tenant); return 0; } },
    branch: { count: async ({ where }) => { assert.equal(where.company.tenantId, tenant); return 0; } },
    employeeProfile: { count: async ({ where }) => { assert.equal(where.tenantId, tenant); return 0; } },
    user: { count: async ({ where }) => { assert.equal(where.tenantId, tenant); return 0; } },
  });
  await assertPlanCapacity(db('tenant-a'), 'tenant-a', 'branches');
  await assertPlanCapacity(db('tenant-b'), 'tenant-b', 'branches');
  assert.deepEqual(seen, ['plan-capacity:tenant-a', 'plan-capacity:tenant-b']);
});
