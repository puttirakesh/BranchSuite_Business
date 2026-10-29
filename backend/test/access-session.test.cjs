require('reflect-metadata');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { ValidationPipe } = require('@nestjs/common');
const { JwtService } = require('@nestjs/jwt');
const { AuthService } = require('../src/modules/auth/auth.service');
const { JwtAuthGuard } = require('../src/modules/auth/gaurds/jwt-auth.guard');
const { UsersService } = require('../src/modules/users/users.service');
const { AssignRoleDto } = require('../src/modules/users/dto/assign-role.dto');
const { EmployeesService } = require('../src/modules/employees/employees.service');

const companyId = '11111111-1111-4111-8111-111111111111';
const otherCompanyId = '22222222-2222-4222-8222-222222222222';
const owner = { id: 'owner', tenantId: 'tenant', roles: ['BUSINESS_OWNER'] };
const admin = { id: 'admin', tenantId: 'tenant', roles: ['BUSINESS_ADMIN'] };
function fixture(roles = ['EMPLOYEE']) {
  const user = { id: 'staff', tenantId: 'tenant', tokenVersion: 0, status: 'ACTIVE',
    tenant: { status: 'ACTIVE' }, roles: roles.map(name => ({ companyId: ['BUSINESS_ADMIN', 'BUSINESS_OWNER'].includes(name) ? null : companyId, role: { name, permissions: [] } })), companyAccess: [], branchAccess: [] };
  const audit = [];
  const tx = {
    user: {
      findFirst: async ({ where }) => where.id === user.id && where.tenantId === user.tenantId ? structuredClone(user) : null,
      findUnique: async () => user,
      update: async () => { user.tokenVersion++; return user; },
      updateMany: async ({ where }) => {
        assert.equal(where.id, user.id); assert.equal(where.tenantId, user.tenantId);
        user.tokenVersion++; return { count: 1 };
      },
    },
    company: { findFirst: async ({ where }) => where.id === companyId && where.tenantId === 'tenant' && (!where.userAccess || where.userAccess.some.userId === admin.id) ? { id: companyId } : null },
    employeeProfile: { findFirst: async () => ({ id: 'profile', branchId: 'branch' }) },
    employeeSalary: { findFirst: async () => ({ id: 'salary' }) },
    // No subscription: plan limits do not apply to these role tests.
    businessSubscription: { findUnique: async () => null },
    userBranchAccess: { findUnique: async () => ({ userId: admin.id }) },
    branch: { count: async () => 0 },
    role: { findUnique: async ({ where }) => ({ id: where.name, name: where.name }) },
    userRole: {
      deleteMany: async ({ where }) => {
        assert.equal(where.userId, user.id);
        user.roles = user.roles.filter(item =>
          !((where.companyId === undefined || item.companyId === where.companyId) &&
            (!where.role || item.role.name === where.role.name)));
      },
      create: async ({ data }) => { user.roles.push({ companyId: data.companyId, role: { name: data.roleId, permissions: [] } }); },
    },
    $transaction: async fn => fn(tx),
  };
  const jwt = new JwtService({ secret: 'test-secret-for-session-revocation', signOptions: { expiresIn: '1h' } });
  const auth = new AuthService(tx, jwt);
  const guard = new JwtAuthGuard(jwt, tx);
  const users = new UsersService(tx, { record: async (_tx, event) => audit.push(event) });
  const sign = () => jwt.sign({ sub: user.id, tenantId: user.tenantId, tokenVersion: user.tokenVersion });
  const check = token => guard.canActivate({ switchToHttp: () => ({ getRequest: () => ({ headers: { authorization: `Bearer ${token}` } }) }) });
  return { user, tx, audit, auth, users, sign, check };
}

test('role DTO accepts supported roles and rejects owner, unknown and missing roles', async () => {
  const pipe = new ValidationPipe({ whitelist: true, transform: true });
  const validate = role => pipe.transform({ role, companyId }, { type: 'body', metatype: AssignRoleDto });
  for (const role of ['EMPLOYEE', 'COMPANY_MANAGER', 'BRANCH_MANAGER', 'SALES_MANAGER', 'HR_MANAGER', 'PAYROLL_MANAGER', 'BUSINESS_ADMIN'])
    assert.equal((await validate(role)).role, role);
  for (const role of ['BUSINESS_OWNER', 'SUPER_ADMIN', '', undefined, null, ['EMPLOYEE']])
    await assert.rejects(validate(role));
});

test('role replacement removes old permissions, audits changes and revokes old tokens', async () => {
  const f = fixture(['EMPLOYEE', 'PAYROLL_MANAGER']);
  const token = f.sign();
  await f.check(token);
  await f.users.replaceRole(owner, 'staff', companyId, 'HR_MANAGER');
  assert.deepEqual(f.user.roles.map(item => item.role.name), ['HR_MANAGER']);
  assert.equal(f.audit[0].action, 'STAFF_ROLE_CHANGED');
  assert.deepEqual(f.audit[0].changes.previousRoles, ['EMPLOYEE', 'PAYROLL_MANAGER']);
  await assert.rejects(f.check(token), error => error.getStatus() === 401);
  await assert.rejects(f.auth.me(`Bearer ${token}`), error => error.getStatus() === 401);
  await f.check(f.sign());
});

test('role management prevents self changes, tenant crossover and privilege escalation', async () => {
  const f = fixture();
  for (const [actor, target, role, status] of [
    [admin, 'staff', 'BUSINESS_ADMIN', 403],
    [{ ...owner, id: 'staff' }, 'staff', 'EMPLOYEE', 400],
    [{ ...owner, tenantId: 'other' }, 'staff', 'HR_MANAGER', 403],
    [{ ...owner, roles: ['EMPLOYEE'] }, 'staff', 'HR_MANAGER', 403],
    [owner, 'staff', 'BUSINESS_OWNER', 400],
  ]) await assert.rejects(f.users.replaceRole(actor, target, companyId, role), error => error.getStatus() === status);
  assert.equal(f.user.tokenVersion, 0);
  await assert.rejects(fixture(['BUSINESS_OWNER']).users.replaceRole(owner, 'staff', companyId, 'EMPLOYEE'), error => error.getStatus() === 403);
  await assert.rejects(fixture(['BUSINESS_ADMIN']).users.replaceRole(admin, 'staff', companyId, 'EMPLOYEE'), error => error.getStatus() === 403);
});

test('owner can promote and demote administrators; repeated assignment is a no-op', async () => {
  const f = fixture();
  await f.users.replaceRole(owner, 'staff', companyId, 'BUSINESS_ADMIN');
  assert.equal(f.user.roles[0].role.name, 'BUSINESS_ADMIN');
  await f.users.replaceRole(owner, 'staff', companyId, 'BUSINESS_ADMIN');
  assert.equal(f.user.tokenVersion, 1);
  await f.users.replaceRole(owner, 'staff', companyId, 'EMPLOYEE');
  assert.deepEqual(f.user.roles.map(item => item.role.name), ['EMPLOYEE']);
});

test('logout invalidates existing JWTs in both auth/me and protected routes; fresh login works', async () => {
  const f = fixture();
  const token = f.sign();
  await f.check(token);
  await f.auth.me(`Bearer ${token}`);
  await f.auth.logout({ id: f.user.id, tenantId: f.user.tenantId });
  await assert.rejects(f.check(token), error => error.getStatus() === 401);
  await assert.rejects(f.auth.me(`Bearer ${token}`), error => error.getStatus() === 401);
  await f.check(f.sign());
  await f.auth.me(`Bearer ${f.sign()}`);
});

test('employee profile includes the backend branch manager and remains scoped to the employee tenant', async () => {
  const prisma = { employeeProfile: { findMany: async args => {
    assert.deepEqual(args.where, { tenantId: 'tenant', userId: 'employee' });
    assert.equal(args.include.branch.select.manager, true);
    return [{ branch: { id: 'branch', name: 'North', manager: 'Assigned manager' } }];
  } } };
  const profiles = await new EmployeesService(prisma, {}).mine({ id: 'employee', tenantId: 'tenant', roles: ['EMPLOYEE'] });
  assert.equal(profiles[0].branch.manager, 'Assigned manager');
});


test('role DTO requires a company UUID v4', async () => {
  const pipe = new ValidationPipe({ whitelist: true, transform: true });
  for (const companyId of [undefined, null, '', 'company', '11111111-1111-1111-8111-111111111111']) {
    await assert.rejects(pipe.transform({ companyId, role: 'EMPLOYEE' }, { type: 'body', metatype: AssignRoleDto }));
  }
});

test('company role replacement preserves other company roles and no-op keeps sessions valid', async () => {
  const f = fixture();
  f.user.roles.push({ companyId: otherCompanyId, role: { name: 'PAYROLL_MANAGER', permissions: [] } });
  await f.users.replaceRole(owner, 'staff', companyId, 'HR_MANAGER');
  assert.deepEqual(f.user.roles.map(({ companyId, role }) => [companyId, role.name]), [[otherCompanyId, 'PAYROLL_MANAGER'], [companyId, 'HR_MANAGER']]);
  assert.equal(f.audit[0].companyId, companyId);
  const token = f.sign();
  await f.users.replaceRole(owner, 'staff', companyId, 'HR_MANAGER');
  assert.equal(f.user.tokenVersion, 1);
  assert.equal(f.audit.length, 1);
  await f.check(token);
});

test('assignment requires company access, employee profile, salary and administrator branch access', async () => {
  for (const [model, method, actor, status] of [
    ['company', 'findFirst', owner, 403],
    ['employeeProfile', 'findFirst', owner, 409],
    ['employeeSalary', 'findFirst', owner, 409],
    ['userBranchAccess', 'findUnique', admin, 403],
  ]) {
    const f = fixture();
    f.tx[model][method] = async () => null;
    await assert.rejects(f.users.replaceRole(actor, 'staff', companyId, 'HR_MANAGER'), error => error.getStatus() === status);
    assert.equal(f.user.tokenVersion, 0);
    assert.equal(f.audit.length, 0);
  }
  const f = fixture();
  await assert.rejects(f.users.replaceRole(owner, 'staff', otherCompanyId, 'HR_MANAGER'), error => error.getStatus() === 403);
  await assert.rejects(f.users.replaceRole(owner, 'missing', companyId, 'HR_MANAGER'), error => error.getStatus() === 404);
});
