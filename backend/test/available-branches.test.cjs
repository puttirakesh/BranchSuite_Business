require('reflect-metadata');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { GUARDS_METADATA } = require('@nestjs/common/constants');
const { BranchesService } = require('../src/modules/branches/branches.service');
const { BranchesController } = require('../src/modules/branches/branches.controller');
const { JwtAuthGuard } = require('../src/modules/auth/gaurds/jwt-auth.guard');
const { BusinessAdminGuard } = require('../src/modules/auth/gaurds/business-admin.guard');

const owner = { id: 'owner', tenantId: 'tenant-a', roles: ['BUSINESS_OWNER'] };
const manager = { id: 'manager', tenantId: 'tenant-a', roles: ['BRANCH_MANAGER'] };

// Evaluate the service's actual Prisma filters against isolated directory records.
// Omitting a tenant, company, status or assignment predicate changes the result.
function matches(row, where) {
  return Object.entries(where).every(([key, condition]) => {
    if (condition && typeof condition === 'object') {
      if ('some' in condition) return (row[key] ?? []).some(item => matches(item, condition.some));
      return row[key] != null && matches(row[key], condition);
    }
    return row[key] === condition;
  });
}

function fixture() {
  const companies = [
    { id: 'company-a', tenantId: 'tenant-a', status: 'ACTIVE', userAccess: [{ userId: 'manager' }] },
    { id: 'company-b', tenantId: 'tenant-a', status: 'ACTIVE', userAccess: [] },
    { id: 'company-inactive', tenantId: 'tenant-a', status: 'INACTIVE', userAccess: [{ userId: 'manager' }] },
    { id: 'company-foreign', tenantId: 'tenant-b', status: 'ACTIVE', userAccess: [{ userId: 'manager' }] },
  ];
  const branch = (id, name, companyId, status, assigned) => ({
    id, name, companyId, status,
    company: companies.find(company => company.id === companyId),
    userAccess: assigned ? [{ userId: 'manager' }] : [],
    // Branch choices must include locations before any employee/CRM rows exist.
    employeeProfiles: [],
  });
  const branches = [
    branch('assigned', 'Vijayawada', 'company-a', 'ACTIVE', true),
    branch('empty', 'Empty location', 'company-a', 'ACTIVE', false),
    branch('inactive', 'Inactive location', 'company-a', 'INACTIVE', true),
    branch('other-company', 'Other company', 'company-b', 'ACTIVE', true),
    branch('foreign', 'Other tenant', 'company-foreign', 'ACTIVE', true),
    branch('inactive-company', 'Closed company location', 'company-inactive', 'ACTIVE', true),
  ];
  let branchQueries = 0;
  const prisma = {
    company: { findFirst: async ({ where }) => companies.find(company => matches(company, where)) ?? null },
    branch: {
      findMany: async ({ where, select, orderBy }) => {
        branchQueries++;
        const rows = branches.filter(item => matches(item, where));
        rows.sort((a, b) => {
          for (const clause of orderBy) {
            const [key, direction] = Object.entries(clause)[0];
            const compared = a[key].localeCompare(b[key]);
            if (compared) return direction === 'asc' ? compared : -compared;
          }
          return 0;
        });
        return rows.map(row => Object.fromEntries(Object.keys(select).map(key => [key, row[key]])));
      },
    },
  };
  return { service: new BranchesService(prisma, {}), branchQueries: () => branchQueries };
}

test('owner sees active company branches, including an empty location, with minimal sorted choices', async () => {
  const { service } = fixture();
  assert.deepEqual(await service.available(owner, 'company-a'), [
    { id: 'empty', companyId: 'company-a', name: 'Empty location', status: 'ACTIVE' },
    { id: 'assigned', companyId: 'company-a', name: 'Vijayawada', status: 'ACTIVE' },
  ]);
});

test('manager sees only assigned active branches in an accessible company', async () => {
  const { service } = fixture();
  const rows = await service.available(manager, 'company-a');
  assert.deepEqual(rows.map(branch => branch.id), ['assigned']);
  await assert.rejects(service.available(manager, 'company-b'), error => error.getStatus() === 404);
});

test('owners and assigned managers cannot read another tenant or an inactive company', async () => {
  for (const actor of [owner, manager]) {
    for (const companyId of ['company-foreign', 'company-inactive']) {
      const { service, branchQueries } = fixture();
      await assert.rejects(service.available(actor, companyId), error => error.getStatus() === 404);
      assert.equal(branchQueries(), 0);
    }
  }
});

test('available branches requires an authenticated user and tenant', async () => {
  const { service, branchQueries } = fixture();
  for (const actor of [undefined, { ...manager, id: '' }, { ...manager, tenantId: '' }]) {
    await assert.rejects(service.available(actor, 'company-a'), error => error.getStatus() === 403);
  }
  assert.equal(branchQueries(), 0);
});

test('branch choices retain JWT authentication while branch management retains its admin guard', () => {
  assert.deepEqual(Reflect.getMetadata(GUARDS_METADATA, BranchesController), [JwtAuthGuard]);
  assert.deepEqual(Reflect.getMetadata(GUARDS_METADATA, BranchesController.prototype.available) ?? [], []);
  for (const action of ['create', 'findAll', 'findOne', 'update', 'updateStatus']) {
    assert.deepEqual(Reflect.getMetadata(GUARDS_METADATA, BranchesController.prototype[action]), [BusinessAdminGuard]);
  }
});
