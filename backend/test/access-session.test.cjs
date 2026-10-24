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

const owner = { id: 'owner', tenantId: 'tenant', roles: ['BUSINESS_OWNER'] };
const admin = { id: 'admin', tenantId: 'tenant', roles: ['BUSINESS_ADMIN'] };
function fixture(roles = ['EMPLOYEE']) {
  const user = { id: 'staff', tenantId: 'tenant', tokenVersion: 0, status: 'ACTIVE',
    tenant: { status: 'ACTIVE' }, roles: roles.map(name => ({ role: { name, permissions: [] } })), companyAccess: [], branchAccess: [] };
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
    role: { findUnique: async ({ where }) => ({ id: where.name, name: where.name }) },
    userRole: {
      deleteMany: async () => { user.roles = []; },
      create: async ({ data }) => { user.roles.push({ role: { name: data.roleId, permissions: [] } }); },
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
  const validate = role => pipe.transform({ role }, { type: 'body', metatype: AssignRoleDto });
  for (const role of ['EMPLOYEE', 'COMPANY_MANAGER', 'BRANCH_MANAGER', 'SALES_MANAGER', 'HR_MANAGER', 'PAYROLL_MANAGER', 'BUSINESS_ADMIN'])
    assert.equal((await validate(role)).role, role);
  for (const role of ['BUSINESS_OWNER', 'SUPER_ADMIN', '', undefined, null, ['EMPLOYEE']])
    await assert.rejects(validate(role));
});

test('role replacement removes old permissions, audits changes and revokes old tokens', async () => {
  const f = fixture(['EMPLOYEE', 'PAYROLL_MANAGER']);
  const token = f.sign();
  await f.check(token);
  await f.users.replaceRole(owner, 'staff', 'HR_MANAGER');
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
    [{ ...owner, tenantId: 'other' }, 'staff', 'HR_MANAGER', 404],
    [{ ...owner, roles: ['EMPLOYEE'] }, 'staff', 'HR_MANAGER', 403],
    [owner, 'staff', 'BUSINESS_OWNER', 400],
  ]) await assert.rejects(f.users.replaceRole(actor, target, role), error => error.getStatus() === status);
  assert.equal(f.user.tokenVersion, 0);
  await assert.rejects(fixture(['BUSINESS_OWNER']).users.replaceRole(owner, 'staff', 'EMPLOYEE'), error => error.getStatus() === 403);
  await assert.rejects(fixture(['BUSINESS_ADMIN']).users.replaceRole(admin, 'staff', 'EMPLOYEE'), error => error.getStatus() === 403);
});

test('owner can promote and demote administrators; repeated assignment is a no-op', async () => {
  const f = fixture();
  await f.users.replaceRole(owner, 'staff', 'BUSINESS_ADMIN');
  assert.equal(f.user.roles[0].role.name, 'BUSINESS_ADMIN');
  await f.users.replaceRole(owner, 'staff', 'BUSINESS_ADMIN');
  assert.equal(f.user.tokenVersion, 1);
  await f.users.replaceRole(owner, 'staff', 'EMPLOYEE');
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
