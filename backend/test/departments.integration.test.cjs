require('dotenv/config');
require('reflect-metadata');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const { NestFactory } = require('@nestjs/core');
const { FastifyAdapter } = require('@nestjs/platform-fastify');
const { ValidationPipe } = require('@nestjs/common');
const { JwtService } = require('@nestjs/jwt');
const { AppModule } = require('../dist/app.module');
const { PrismaService } = require('../dist/prisma/prisma.service');

test('department directory persists independent of employees and enforces scope and duplicate rules', { skip: process.env.RUN_DEPARTMENT_INTEGRATION !== '1', timeout: 60000 }, async t => {
  const app = await NestFactory.create(AppModule, new FastifyAdapter(), { logger: false });
  app.setGlobalPrefix('api/v1'); app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init(); await app.getHttpAdapter().getInstance().ready();
  const prisma = app.get(PrismaService);
  const tenantId = randomUUID();
  const foreignTenantId = randomUUID();
  t.after(async () => {
    try {
      await prisma.auditEvent.deleteMany({ where: { tenantId } });
      await prisma.employeeProfile.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
      await prisma.tenant.deleteMany({ where: { id: { in: [tenantId, foreignTenantId] } } });
    } finally { await app.close(); }
  });
  await prisma.tenant.create({ data: { id: tenantId, name: 'Department test' } });
  await prisma.tenant.create({ data: { id: foreignTenantId, name: 'Other tenant' } });
  const company = await prisma.company.create({ data: { tenantId, name: 'Company' } });
  const foreignCompany = await prisma.company.create({ data: { tenantId: foreignTenantId, name: 'Foreign' } });
  const north = await prisma.branch.create({ data: { companyId: company.id, name: 'North', code: 'NORTH' } });
  const south = await prisma.branch.create({ data: { companyId: company.id, name: 'South', code: 'SOUTH' } });
  const foreignBranch = await prisma.branch.create({ data: { companyId: foreignCompany.id, name: 'Foreign', code: 'FOREIGN' } });
  const jwt = new JwtService({ secret: process.env.JWT_SECRET });
  const token = async role => {
    const person = await prisma.user.create({ data: {
      tenantId, name: role, email: `${randomUUID()}@example.invalid`, password: 'unused-test-password',
      roles: { create: { role: { connect: { name: role } } } },
      companyAccess: { create: { companyId: company.id } }, branchAccess: { create: { branchId: north.id } },
    } });
    return jwt.sign({ sub: person.id, tenantId, tokenVersion: person.tokenVersion });
  };
  const owner = await token('BUSINESS_OWNER');
  const admin = await token('BUSINESS_ADMIN');
  const employee = await token('EMPLOYEE');
  const request = async (method, url, body, auth = owner, status = 200) => {
    const result = await app.getHttpAdapter().getInstance().inject({ method, url: `/api/v1${url}`, ...(auth ? { headers: { authorization: `Bearer ${auth}` } } : {}), ...(body ? { payload: body } : {}) });
    assert.equal(result.statusCode, status, `${method} ${url}: ${result.body}`);
    return result.json();
  };
  await request('GET', `/departments?companyId=${company.id}`, undefined, null, 401);
  const global = await request('POST', '/departments', { companyId: company.id, name: '  Business   Operations  ' }, owner, 201);
  assert.equal(global.name, 'Business Operations'); assert.equal(global.branchId, null);
  const sales = await request('POST', '/departments', { companyId: company.id, branchId: north.id, name: 'Sales' }, admin, 201);
  const southSales = await request('POST', '/departments', { companyId: company.id, branchId: south.id, name: 'Sales' }, owner, 201);
  await request('POST', '/departments', { companyId: company.id, name: 'business operations' }, owner, 409);
  await request('POST', '/departments', { companyId: company.id, branchId: north.id, name: ' SALES ' }, owner, 409);
  await request('POST', '/departments', { companyId: company.id, name: '   ' }, owner, 400);
  await request('POST', '/departments', { companyId: company.id, name: 'x'.repeat(101) }, owner, 400);
  await request('POST', '/departments', { companyId: company.id, name: 'Employee creation' }, employee, 403);
  await request('GET', `/departments?companyId=${company.id}`, undefined, employee, 403);
  await request('POST', '/departments', { companyId: foreignCompany.id, name: 'No access' }, owner, 404);
  await request('POST', '/departments', { companyId: company.id, branchId: foreignBranch.id, name: 'Wrong branch' }, owner, 404);
  await request('POST', '/departments', { companyId: company.id, branchId: south.id, name: 'Unassigned' }, admin, 404);
  await request('GET', `/departments?companyId=${company.id}&branchId=${south.id}`, undefined, admin, 404);
  const northList = await request('GET', `/departments?companyId=${company.id}&branchId=${north.id}`);
  assert.deepEqual(new Set(northList.map(item => item.id)), new Set([global.id, sales.id]));
  const adminList = await request('GET', `/departments?companyId=${company.id}`, undefined, admin);
  assert.deepEqual(new Set(adminList.map(item => item.id)), new Set([global.id, sales.id]));
  const southList = await request('GET', `/departments?companyId=${company.id}&branchId=${south.id}`);
  assert.ok(southList.some(item => item.id === global.id)); assert.ok(!southList.some(item => item.id === sales.id));
  assert.equal(await prisma.employeeProfile.count({ where: { tenantId } }), 0, 'Departments exist before any employee profiles');
  assert.equal(await prisma.auditEvent.count({ where: { tenantId, action: 'DEPARTMENT_CREATED' } }), 3);
  const hire = async (name, department, branchId, extra = {}) => {
    const person = await prisma.user.create({ data: { tenantId, name, email: `${randomUUID()}@example.invalid`, password: 'unused' } });
    return prisma.employeeProfile.create({ data: { tenantId, companyId: company.id, branchId, userId: person.id, employeeCode: randomUUID(), department, designation: 'Specialist', joiningDate: new Date('2026-01-01'), ...extra } });
  };
  const northSalesOne = await hire('North salesperson', 'Sales', north.id);
  await hire('North inactive salesperson', ' sales  ', north.id, { status: 'INACTIVE' });
  const southSalesOne = await hire('South salesperson', 'Sales', south.id);
  await hire('North operations', 'Business Operations', north.id);
  await hire('South operations', 'Business Operations', south.id);
  const foreignPerson = await prisma.user.create({ data: { tenantId: foreignTenantId, name: 'Foreign salesperson', email: `${randomUUID()}@example.invalid`, password: 'unused' } });
  await prisma.employeeProfile.create({ data: { tenantId: foreignTenantId, companyId: foreignCompany.id, branchId: foreignBranch.id, userId: foreignPerson.id, employeeCode: 'FOREIGN', department: 'Sales', joiningDate: new Date('2026-01-01') } });
  const totals = await request('GET', `/departments?companyId=${company.id}`);
  assert.equal(totals.find(item => item.id === sales.id).employeeCount, 2);
  assert.equal(totals.find(item => item.id === sales.id).totalEmployeeCount, 3);
  assert.equal(totals.find(item => item.id === global.id).employeeCount, 2);
  const filteredTotals = await request('GET', `/departments?companyId=${company.id}&branchId=${north.id}`);
  assert.equal(filteredTotals.find(item => item.id === global.id).employeeCount, 1);
  assert.equal(filteredTotals.find(item => item.id === sales.id).totalEmployeeCount, 2);
  const salesEmployees = await request('GET', `/departments/${sales.id}/employees`);
  assert.equal(salesEmployees.length, 3, 'All branches combines people in the same department');
  assert.ok(salesEmployees.some(person => person.id === northSalesOne.userId));
  assert.ok(!salesEmployees.some(person => person.id === foreignPerson.id));
  assert.equal((await request('GET', `/departments/${sales.id}/employees?branchId=${north.id}`)).length, 2);
  assert.equal((await request('GET', `/departments/${southSales.id}/employees?branchId=${south.id}`)).length, 1);
  assert.equal((await request('GET', `/departments/${global.id}/employees?branchId=${north.id}`)).length, 1);
  assert.equal((await request('GET', `/departments/${global.id}/employees`)).length, 2);
  assert.equal((await request('GET', `/departments/${sales.id}/employees`, undefined, admin)).length, 2, 'All branches includes only branches accessible to the admin');
  await request('GET', `/departments/${sales.id}/employees`, undefined, employee, 403);
  await request('GET', `/departments/${sales.id}/employees?branchId=${south.id}`, undefined, admin, 404);
  await request('GET', `/departments/${sales.id}/employees?branchId=${foreignBranch.id}`, undefined, owner, 404);
  await prisma.employeeProfile.update({ where: { id: southSalesOne.id }, data: { department: 'Business Operations' } });
  assert.equal((await request('GET', `/departments/${sales.id}/employees`)).length, 2);
  assert.equal((await request('GET', `/departments?companyId=${company.id}`)).find(item => item.id === global.id).employeeCount, 3);
  // The database also resolves concurrent duplicate submissions deterministically.
  const body = { companyId: company.id, branchId: north.id, name: 'Concurrent' };
  const results = await Promise.all([1, 2].map(() => app.getHttpAdapter().getInstance().inject({ method: 'POST', url: '/api/v1/departments', headers: { authorization: `Bearer ${owner}` }, payload: body })));
  assert.deepEqual(results.map(result => result.statusCode).sort(), [201, 409]);
});
