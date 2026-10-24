require('dotenv/config');
require('reflect-metadata');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const bcrypt = require('bcrypt');
const { NestFactory } = require('@nestjs/core');
const { FastifyAdapter } = require('@nestjs/platform-fastify');
const { ValidationPipe } = require('@nestjs/common');
const { AppModule } = require('../dist/app.module');
const { PrismaService } = require('../dist/prisma/prisma.service');

// Opt in explicitly: fixtures use a separate tenant and are removed after the run.
test('application workflows against PostgreSQL', { skip: process.env.RUN_APP_INTEGRATION !== '1' && process.env.npm_lifecycle_event !== 'test:integration', timeout: 600000 }, async t => {
  const app = await NestFactory.create(AppModule, new FastifyAdapter(), { logger: false });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  const prisma = app.get(PrismaService);
  const tenantId = randomUUID();
  const password = `Test-${randomUUID()}`;
  const leaveDate = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  const leaveYear = Number(leaveDate.slice(0, 4));
  let owner, manager, employee, company, otherCompany, branch, secondBranch, otherBranch;
  const tokens = {};
  const liveOrigin = process.env.INTEGRATION_API_ORIGIN;
  if (liveOrigin) assert.ok(['127.0.0.1', 'localhost'].includes(new URL(liveOrigin).hostname), 'Live integration checks must target the local backend.');
  const request = async (method, path, body, role = 'owner', expected = method === 'POST' ? 201 : 200) => {
    const headers = { ...(tokens[role] ? { authorization: `Bearer ${tokens[role]}` } : {}), ...(body === undefined ? {} : { 'content-type': 'application/json' }) };
    const live = liveOrigin ? await fetch(`${liveOrigin}/api/v1${path}`, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15000) }) : null;
    const liveBody = live ? await live.text() : null;
    const result = live ? { statusCode: live.status, body: liveBody, json: () => JSON.parse(liveBody) } : await app.inject({ method, url: `/api/v1${path}`, headers, ...(body === undefined ? {} : { payload: body }) });
    assert.equal(result.statusCode, expected, `${role} ${method} ${path}: ${result.body}`);
    return result.json();
  };
  t.after(async () => {
    try {
      await prisma.payrollAdvanceRecovery.deleteMany({ where: { entry: { run: { tenantId } } } });
      await prisma.employeeDocument.deleteMany({ where: { tenantId } });
      await prisma.supportTicket.deleteMany({ where: { tenantId } });
      await prisma.billingInvoice.deleteMany({ where: { tenantId } });
      await prisma.payrollIncentive.deleteMany({ where: { tenantId } });
      await prisma.leadHistory.deleteMany({ where: { tenantId } });
      await prisma.quoteItem.deleteMany({ where: { quote: { tenantId } } });
      await prisma.quote.deleteMany({ where: { tenantId } });
      await prisma.dealStageHistory.deleteMany({ where: { tenantId } });
      await prisma.deal.deleteMany({ where: { tenantId } });
      await prisma.auditEvent.deleteMany({ where: { tenantId } });
      await prisma.payrollPayment.deleteMany({ where: { entry: { run: { tenantId } } } });
      await prisma.employeeProfile.deleteMany({ where: { tenantId } });
      await prisma.companyPayrollPolicy.deleteMany({ where: { tenantId } });
      await prisma.tenant.deleteMany({ where: { id: tenantId } });
    } finally { await app.close(); }
  });
  await prisma.tenant.create({ data: { id: tenantId, name: `Integration ${tenantId}` } });
  await prisma.businessSubscription.create({ data: { tenantId, planId: 'starter', billingCycle: 'monthly' } });
  company = await prisma.company.create({ data: { tenantId, name: 'Test company' } });
  otherCompany = await prisma.company.create({ data: { tenantId, name: 'Other test company' } });
  branch = await prisma.branch.create({ data: { companyId: company.id, name: 'Test North', code: 'TEST_N' } });
  secondBranch = await prisma.branch.create({ data: { companyId: company.id, name: 'Test South', code: 'TEST_S' } });
  otherBranch = await prisma.branch.create({ data: { companyId: otherCompany.id, name: 'Test Other', code: 'TEST_O' } });
  const createUser = async role => {
    const configuredRole = await prisma.role.findUniqueOrThrow({ where: { name: role } });
    return prisma.user.create({ data: {
      tenantId, name: role, email: `${role.toLowerCase()}-${tenantId}@example.invalid`, password: await bcrypt.hash(password, 4),
      roles: { create: { roleId: configuredRole.id } }, companyAccess: { create: { companyId: company.id } },
      branchAccess: { create: [{ branchId: branch.id }, ...(role === 'EMPLOYEE' ? [] : [{ branchId: secondBranch.id }])] },
    } });
  };
  owner = await createUser('BUSINESS_OWNER'); manager = await createUser('BRANCH_MANAGER'); employee = await createUser('EMPLOYEE');
  const approver = await createUser('BUSINESS_ADMIN');
  const hr = await createUser('HR_MANAGER');
  const payroll = await createUser('PAYROLL_MANAGER');
  const employeeProfile = await prisma.employeeProfile.create({ data: { tenantId, companyId: company.id, branchId: branch.id, userId: employee.id, employeeCode: 'TEST01', joiningDate: new Date('2026-01-01') } });
  for (const [role, user] of Object.entries({ owner, manager, employee, approver, hr, payroll })) {
    const result = await request('POST', '/auth/login', { email: user.email, password, portal: role === 'employee' ? 'employee' : 'staff' }, role);
    tokens[role] = result.accessToken;
  }

  await t.test('employee numbering is company-scoped, concurrent and forward-only', async () => {
    const numbered = await prisma.company.create({ data: { tenantId, name: 'Numbering company' } });
    const numberedBranch = await prisma.branch.create({ data: { companyId: numbered.id, name: 'Numbering branch', code: 'NUMBERING' } });
    const path = `/companies/${numbered.id}/employee-numbering`;
    await request('PATCH', path, { prefix: 'acm', digits: 3, nextNumber: 1 });
    await request('PATCH', path, { prefix: 'BAD PREFIX', digits: 3, nextNumber: 1 }, 'owner', 400);
    await request('PATCH', path, { prefix: 'ACM', digits: 0, nextNumber: 1 }, 'owner', 400);
    await request('PATCH', path, { prefix: 'ACM', digits: 3, nextNumber: 1 }, 'manager', 403);
    const hire = async (index, extra = {}) => {
      const person = await request('POST', '/users', { name: `Numbered employee ${index}`, email: `numbered-${index}-${tenantId}@example.invalid`, password });
      return request('POST', '/employees', { companyId: numbered.id, branchId: numberedBranch.id, userId: person.id, joiningDate: '2026-01-01', ...extra });
    };
    const legacy = await hire('legacy', { employeeCode: 'ACM-001' });
    const concurrent = await Promise.all([hire(1), hire(2)]);
    assert.deepEqual(concurrent.map(item => item.employeeCode).sort(), ['ACM-002', 'ACM-003']);
    assert.equal((await request('GET', `/companies/${numbered.id}`)).employeeIdNext, 4);
    await request('PATCH', path, { prefix: 'ACM', digits: 3, nextNumber: 1 }, 'owner', 400);
    await prisma.employeeProfile.delete({ where: { id: concurrent[0].id } });
    // Existing imported codes can be ahead of the configured sequence.
    await prisma.employeeProfile.create({ data: { tenantId, companyId: numbered.id, branchId: numberedBranch.id, userId: concurrent[0].userId, employeeCode: 'ACM-004', joiningDate: new Date('2026-01-01') } });
    assert.equal((await hire(3)).employeeCode, 'ACM-005');
    await request('POST', '/employees', { companyId: numbered.id, branchId: numberedBranch.id, userId: legacy.userId, joiningDate: '2026-01-01' }, 'owner', 409);
    assert.equal((await request('GET', `/companies/${numbered.id}`)).employeeIdNext, 6, 'Failed creation must roll back its reserved number');
    await request('PATCH', path, { prefix: 'NEW', digits: 4, nextNumber: 1000 });
    assert.equal((await hire(4)).employeeCode, 'NEW-1000');
    assert.equal((await prisma.employeeProfile.findUniqueOrThrow({ where: { id: legacy.id } })).employeeCode, 'ACM-001');
    const person = await request('POST', '/users', { name: 'Other company employee', email: `numbered-other-${tenantId}@example.invalid`, password });
    const independent = await request('POST', '/employees', { companyId: otherCompany.id, branchId: otherBranch.id, userId: person.id, joiningDate: '2026-01-01' });
    assert.equal(independent.employeeCode, 'EMP-001');
    const foreignTenant = await prisma.tenant.create({ data: { name: 'Numbering isolated tenant' } });
    try {
      const foreign = await prisma.company.create({ data: { tenantId: foreignTenant.id, name: 'Foreign company' } });
      await request('PATCH', `/companies/${foreign.id}/employee-numbering`, { prefix: 'BAD', digits: 3, nextNumber: 1 }, 'owner', 404);
    } finally { await prisma.tenant.delete({ where: { id: foreignTenant.id } }); }
  });

  await t.test('roles, employee manager and logout persist and enforce access immediately', async () => {
    const staff = await request('POST', '/users', { name: 'Access test', email: `access-${tenantId}@example.invalid`, password });
    await request('PUT', `/users/${staff.id}/access`, { companyId: company.id, branchIds: [branch.id] });
    let login = await request('POST', '/auth/login', { email: staff.email, password, portal: 'employee' });
    tokens.accessTest = login.accessToken;
    await request('POST', `/users/${staff.id}/roles`, { role: 'HR_MANAGER' });
    await request('GET', '/auth/me', undefined, 'accessTest', 401);
    await request('GET', '/employees/me', undefined, 'accessTest', 401);
    login = await request('POST', '/auth/login', { email: staff.email, password, portal: 'staff' });
    assert.equal(login.session.memberships[0].role, 'HR_MANAGER');
    tokens.accessTest = login.accessToken;
    await request('POST', `/users/${staff.id}/roles`, { role: 'BUSINESS_ADMIN' }, 'approver', 403);
    await request('POST', `/users/${owner.id}/roles`, { role: 'EMPLOYEE' }, 'owner', 400);
    await request('POST', `/users/${staff.id}/roles`, { role: 'BUSINESS_OWNER' }, 'owner', 400);
    await request('POST', '/auth/logout', undefined, 'accessTest');
    await request('GET', '/auth/me', undefined, 'accessTest', 401);
    await request('GET', '/employees/me', undefined, 'accessTest', 401);
    await request('POST', '/auth/logout', undefined, 'accessTest', 401);
    login = await request('POST', '/auth/login', { email: staff.email, password, portal: 'staff' });
    tokens.accessTest = login.accessToken;
    await request('GET', '/auth/me', undefined, 'accessTest');
    await request('PATCH', `/branches/${branch.id}`, { manager: 'Backend manager' });
    const profiles = await request('GET', '/employees/me', undefined, 'employee');
    assert.equal(profiles.find(profile => profile.id === employeeProfile.id).branch.manager, 'Backend manager');
  });

  await t.test('branch manager assignment provisions and safely revokes branch access', async () => {
    const configuredRole = await prisma.role.findUniqueOrThrow({ where: { name: 'BRANCH_MANAGER' } });
    const assignedManager = await prisma.user.create({ data: {
      tenantId, name: 'New branch manager', email: `assigned-manager-${tenantId}@example.invalid`, password: await bcrypt.hash(password, 4),
      roles: { create: { roleId: configuredRole.id } },
    } });
    await request('PATCH', `/branches/${secondBranch.id}`, { managerUserId: assignedManager.id });
    assert.equal((await prisma.userBranchAccess.findUniqueOrThrow({ where: { userId_branchId: { userId: assignedManager.id, branchId: secondBranch.id } } })).grantSource, 'BRANCH_MANAGER');
    assert.equal((await prisma.userCompanyAccess.findUniqueOrThrow({ where: { userId_companyId: { userId: assignedManager.id, companyId: company.id } } })).grantSource, 'BRANCH_MANAGER');
    const login = await request('POST', '/auth/login', { email: assignedManager.email, password, portal: 'staff' });
    tokens.assignedManager = login.accessToken;
    assert.ok((await request('GET', `/branches/available?companyId=${company.id}`, undefined, 'assignedManager')).some(item => item.id === secondBranch.id));
    await request('POST', `/users/${assignedManager.id}/roles`, { role: 'EMPLOYEE' }, 'owner', 409);
    await request('PATCH', `/branches/${secondBranch.id}`, { managerUserId: null });
    assert.equal(await prisma.userBranchAccess.findUnique({ where: { userId_branchId: { userId: assignedManager.id, branchId: secondBranch.id } } }), null);
    assert.equal(await prisma.userCompanyAccess.findUnique({ where: { userId_companyId: { userId: assignedManager.id, companyId: company.id } } }), null);
  });

  await t.test('all module list endpoints authenticate and return valid responses', async () => {
    for (const path of [
      '/auth/me', `/branches/available?companyId=${company.id}`, `/branches?companyId=${company.id}`,
      `/employees?companyId=${company.id}`, `/leads?companyId=${company.id}`, `/customers?companyId=${company.id}`,
      `/activities?companyId=${company.id}`, `/deals?companyId=${company.id}`, `/deals/owners?companyId=${company.id}`,
      `/quotes?companyId=${company.id}`, `/tasks?companyId=${company.id}`, `/attendance?companyId=${company.id}`,
      `/attendance/corrections?companyId=${company.id}`, `/leave/types?companyId=${company.id}`, `/leave/requests?companyId=${company.id}`,
      `/leave/balances?companyId=${company.id}&branchId=${branch.id}&userId=${employee.id}`, `/payroll/policies?companyId=${company.id}`,
      `/payroll/employee-salaries?companyId=${company.id}&branchId=${branch.id}`, `/payroll/periods?companyId=${company.id}&branchId=${branch.id}`,
      `/advances?companyId=${company.id}&branchId=${branch.id}`, `/audit?companyId=${company.id}`, '/subscriptions/current',
    ]) await request('GET', path);
  });

  await t.test('HR and payroll roles can use their assigned modules without receiving business-wide access', async () => {
    for (const role of ['hr', 'payroll']) {
      const directory = await request('GET', `/employees?companyId=${company.id}`, undefined, role); assert.equal(directory.items.length, 1);
      await request('GET', `/employees/${employeeProfile.id}`, undefined, role);
      const outside = await request('GET', `/employees?companyId=${otherCompany.id}`, undefined, role); assert.equal(outside.items.length, 0);
      await request('GET', `/leads?companyId=${company.id}`, undefined, role, 403);
      await request('GET', '/subscriptions/current', undefined, role, 403);
    }
    await request('GET', `/leave/requests?companyId=${company.id}`, undefined, 'hr');
    await request('GET', `/attendance?companyId=${company.id}`, undefined, 'hr');
    await request('GET', `/payroll/employee-salaries?companyId=${company.id}&branchId=${branch.id}`, undefined, 'payroll');
    await request('GET', `/payroll/employee-salaries?companyId=${otherCompany.id}&branchId=${otherBranch.id}`, undefined, 'payroll', 403);
    await request('GET', `/payroll/employee-salaries?companyId=${company.id}&branchId=${branch.id}`, undefined, 'hr', 403);
    await request('GET', `/advances?companyId=${company.id}&branchId=${branch.id}`, undefined, 'payroll');
  });

  let lead, customer, deal, quote;
  await t.test('the new lead form saves lead, opportunity and follow-up as one operation', async () => {
    const created = await request('POST', '/leads', { companyId: company.id, branchId: branch.id, name: 'Atomic lead test', stage: 'QUALIFIED', estimatedValue: '5000', followUpAt: new Date().toISOString(), opportunity: { title: 'Atomic opportunity', amount: '5000' } });
    assert.equal(created.stage, 'QUALIFIED');
    const opportunity = await prisma.deal.findFirstOrThrow({ where: { leadId: created.id, tenantId } }); assert.equal(Number(opportunity.amount), 5000);
    assert.equal(await prisma.crmActivity.count({ where: { leadId: created.id, type: 'FOLLOW_UP', status: 'PENDING' } }), 1);
    await prisma.deal.delete({ where: { id: opportunity.id } });
    await prisma.crmActivity.deleteMany({ where: { leadId: created.id, tenantId } });
    await prisma.lead.delete({ where: { id: created.id } });
  });
  await t.test('lead metadata, multiple assignees, stages and customer conversion persist', async () => {
    await request('POST', '/leads', { companyId: company.id, branchId: branch.id, name: '   ' }, 'owner', 400);
    await request('POST', '/customers', { companyId: company.id, branchId: branch.id, name: '   ' }, 'owner', 400);
    lead = await request('POST', '/leads', { companyId: company.id, branchId: branch.id, name: 'Integration lead', contactPerson: 'Contact person', source: 'Referral', estimatedValue: '1250.50', assignedEmployeeIds: [employee.id, owner.id] });
    assert.equal(lead.contactPerson, 'Contact person'); assert.equal(String(lead.estimatedValue), '1250.5');
    assert.deepEqual(lead.assignedEmployeeIds, [employee.id, owner.id]); assert.equal(lead.assignedToId, employee.id);
    await request('PATCH', `/leads/${lead.id}`, { name: null }, 'owner', 400);
    await request('PATCH', `/leads/${lead.id}`, { assignedEmployeeIds: [owner.id], estimatedValue: '2000' });
    await request('PATCH', `/leads/${lead.id}/stage`, { stage: 'NEGOTIATION' });
    const historyEntry = await request('POST', `/leads/${lead.id}/history`, { id: 'local-history-' + tenantId, kind: 'edit', note: 'Imported lead history entry' });
    assert.equal(historyEntry.leadId, lead.id);
    assert.ok((await request('GET', `/leads/history?companyId=${company.id}`)).some(entry => entry.id === historyEntry.id));
    const converted = await request('POST', `/leads/${lead.id}/convert`, {}); customer = converted.customer;
    const repeated = await request('POST', `/leads/${lead.id}/convert`, {}); assert.equal(repeated.customer.id, customer.id);
    const read = await request('GET', `/leads/${lead.id}`); assert.equal(read.stage, 'WON'); assert.equal(read.convertedCustomerId, customer.id);
    await request('PATCH', `/leads/${lead.id}`, { name: 'Locked' }, 'owner', 409);
    await request('PATCH', `/customers/${customer.id}`, { name: 'Updated customer', notes: 'Persistent notes' });
    await request('PATCH', `/customers/${customer.id}/status`, { status: 'INACTIVE' });
    assert.equal((await request('PATCH', `/customers/${customer.id}/status`, { status: 'ACTIVE' })).status, 'ACTIVE');
  });

  await t.test('manager company and branch filters do not broaden to other assigned scopes', async () => {
    const south = await request('POST', '/customers', { companyId: company.id, branchId: secondBranch.id, name: 'South customer' });
    await request('POST', '/customers', { companyId: otherCompany.id, branchId: otherBranch.id, name: 'Other company customer' });
    const selected = await request('GET', `/customers?companyId=${company.id}&branchId=${secondBranch.id}`, undefined, 'manager');
    assert.deepEqual(selected.data.map(row => row.id), [south.id]);
    const other = await request('GET', `/customers?companyId=${otherCompany.id}`, undefined, 'manager'); assert.equal(other.data.length, 0);
    const activity = await request('POST', '/activities', { companyId: company.id, branchId: secondBranch.id, customerId: south.id, title: 'South follow-up', type: 'FOLLOW_UP', scheduledAt: new Date().toISOString() });
    const selectedActivities = await request('GET', `/activities?companyId=${company.id}&branchId=${secondBranch.id}`, undefined, 'manager');
    assert.deepEqual(selectedActivities.data.map(row => row.id), [activity.id]);
    await request('PATCH', `/activities/${activity.id}/cancel`);
    await request('PATCH', `/activities/${activity.id}/complete`, undefined, 'owner', 409);
  });

  await t.test('deals, quotations, optimistic locking and stage history work together', async () => {
    await request('POST', '/deals', { companyId: company.id, branchId: branch.id, title: '   ' }, 'owner', 400);
    deal = await request('POST', '/deals', { companyId: company.id, branchId: branch.id, leadId: lead.id, customerId: customer.id, title: 'Test opportunity', amount: '2000', ownerId: owner.id });
    await request('PATCH', `/deals/${deal.id}`, { ownerId: null }, 'owner', 400);
    // A branch manager can edit an accessible deal without reassigning its owner.
    await request('PATCH', `/deals/${deal.id}`, { title: 'Manager update', amount: null, customerId: null }, 'manager');
    let current = await request('GET', `/deals/${deal.id}`); assert.equal(current.amount, null); assert.equal(current.customerId, null);
    await request('PATCH', `/deals/${deal.id}`, { amount: '2000', customerId: customer.id });
    quote = await request('POST', '/quotes', { dealId: deal.id, title: 'Test quotation', notes: 'Keep these notes', items: [{ description: 'Service', quantity: 3, unitPrice: '12.50' }] });
    assert.equal(Number(quote.total), 37.5);
    assert.equal((await request('GET', `/quotes?companyId=${company.id}`)).length, 1);
    quote = await request('PATCH', `/quotes/${quote.id}`, { expectedVersion: 1, title: 'Updated quotation', notes: quote.notes, items: [{ description: 'Service', quantity: 4, unitPrice: '12.50' }] });
    assert.equal(Number(quote.total), 50); assert.equal(quote.notes, 'Keep these notes');
    await request('PATCH', `/quotes/${quote.id}`, { expectedVersion: 1, title: 'Stale update', items: [{ description: 'Service', quantity: 1, unitPrice: '1' }] }, 'owner', 409);
    quote = await request('POST', `/quotes/${quote.id}/status`, { status: 'SENT', expectedVersion: 2 });
    await request('POST', `/quotes/${quote.id}/status`, { status: 'ACCEPTED', expectedVersion: quote.version });
    for (const stage of ['QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON']) await request('POST', `/deals/${deal.id}/transition`, { stage });
    const history = await request('GET', `/deals/${deal.id}/history`); assert.equal(history.length, 4);
    await request('PATCH', `/deals/${deal.id}`, { title: 'Closed' }, 'owner', 409);
    const audit = await request('GET', `/audit?companyId=${company.id}`); assert.ok(audit.items.length > 0);
    const dashboard = await app.inject({ method: 'GET', url: '/api/v1/dashboard', headers: { authorization: `Bearer ${tokens.owner}`, 'x-tenant-id': tenantId, 'x-company-id': company.id, 'x-branch-id': branch.id } });
    assert.equal(dashboard.statusCode, 200, dashboard.body); assert.equal(dashboard.json().leads, 1); assert.equal(dashboard.json().pipelineValue, 0);
  });

  await t.test('employee task and attendance workflows persist across roles', async () => {
    const task = await request('POST', '/tasks', { companyId: company.id, branchId: branch.id, assignedToId: employee.id, title: 'Employee test task', priority: 'HIGH' });
    assert.ok((await request('GET', '/tasks/my', undefined, 'employee')).some(row => row.id === task.id));
    await request('PATCH', `/tasks/${task.id}/status`, { status: 'IN_PROGRESS' }, 'employee');
    await request('POST', `/tasks/${task.id}/comments`, { message: 'Working on it' }, 'employee');
    await request('PATCH', `/tasks/${task.id}/status`, { status: 'COMPLETED' }, 'employee');
    const profile = await request('GET', '/employees/me', undefined, 'employee'); assert.equal(profile[0].branchId, branch.id);
    await request('POST', '/attendance/check-in', { companyId: company.id, branchId: branch.id }, 'employee');
    await request('POST', '/attendance/check-out', { companyId: company.id, branchId: branch.id }, 'employee');
    const attendance = await request('GET', '/attendance/my-history', undefined, 'employee');
    assert.equal(attendance.data.length, 1); assert.ok(attendance.data[0].checkOutAt);
  });

  await t.test('employee documents and support tickets persist across employee and admin screens', async () => {
    const document = await request('POST', '/employee-documents', {
      companyId: company.id, branchId: branch.id, employeeId: employee.id,
      title: 'Employment confirmation', kind: 'VERIFICATION', content: 'This document verifies active employment.',
    }, 'hr');
    assert.equal(document.employeeId, employee.id);
    assert.ok((await request('GET', '/employee-documents/my', undefined, 'employee')).some(item => item.id === document.id));
    assert.ok((await request('GET', `/employee-documents?companyId=${company.id}&employeeId=${employee.id}`, undefined, 'hr')).some(item => item.id === document.id));
    const attachment = await request('POST', '/employee-documents', {
      companyId: company.id, branchId: branch.id, employeeId: employee.id,
      title: 'Signed acknowledgement', kind: 'OTHER', fileName: 'acknowledgement.txt',
      mimeType: 'text/plain', fileDataBase64: Buffer.from('Employee acknowledgement').toString('base64'),
    }, 'hr');
    assert.equal(attachment.content, null);
    assert.equal(attachment.fileName, 'acknowledgement.txt');
    assert.deepEqual(await request('GET', `/employee-documents/${attachment.id}/file`, undefined, 'employee'), {
      fileName: 'acknowledgement.txt', mimeType: 'text/plain', fileDataBase64: Buffer.from('Employee acknowledgement').toString('base64'),
    });
    await request('POST', '/workspace/preferences', { companyId: company.id, key: 'profile', value: { compact: true } }, 'employee');
    assert.deepEqual((await request('GET', `/workspace/preferences?companyId=${company.id}&key=profile`, undefined, 'employee')).value, { compact: true });
    await request('DELETE', `/workspace/preferences?companyId=${company.id}&key=profile`, undefined, 'employee');
    assert.equal(await request('GET', `/workspace/preferences?companyId=${company.id}&key=profile`, undefined, 'employee'), null);
    await request('POST', '/employee-documents', {
      companyId: otherCompany.id, branchId: otherBranch.id, employeeId: employee.id,
      title: 'Out of scope', kind: 'OTHER', content: 'This must be rejected.',
    }, 'hr', 404);

    const ticket = await request('POST', '/support/tickets', {
      companyId: company.id, branchId: branch.id, category: 'PAYROLL',
      subject: 'Payroll question', message: 'Please clarify the published payslip.',
    }, 'employee');
    assert.equal(ticket.messages.length, 1);
    const listed = await request('GET', '/support/tickets/my', undefined, 'employee');
    assert.ok(listed.some(item => item.id === ticket.id));
    const reply = await request('POST', `/support/tickets/${ticket.id}/messages`, { message: 'We are reviewing your payroll question.' });
    assert.equal(reply.messages.length, 2);
    assert.ok((await request('GET', `/support/tickets?companyId=${company.id}`)).some(item => item.id === ticket.id));
    const updated = await request('PATCH', `/support/tickets/${ticket.id}`, { status: 'IN_PROGRESS' });
    assert.equal(updated.status, 'IN_PROGRESS');
    assert.equal((await request('GET', '/support/tickets/my', undefined, 'employee')).find(item => item.id === ticket.id).status, 'IN_PROGRESS');
  });

  await t.test('invoice records and manually confirmed payment status persist', async () => {
    const invoice = await request('POST', '/billing/invoices', {
      companyId: company.id, description: 'Monthly subscription invoice', amount: '1250.00', currency: 'INR', dueDate: '2026-11-30',
    });
    assert.equal(invoice.status, 'ISSUED');
    assert.ok((await request('GET', `/billing/invoices?companyId=${company.id}`)).some(item => item.id === invoice.id));
    await request('GET', `/billing/invoices?companyId=${company.id}`, undefined, 'hr', 403);
    const paid = await request('POST', `/billing/invoices/${invoice.id}/record-payment`, { note: 'Verified bank transfer reference TEST-INV-1' });
    assert.equal(paid.status, 'PAID');
    assert.equal(paid.paymentNote, 'Verified bank transfer reference TEST-INV-1');
    assert.equal((await request('GET', `/billing/invoices?companyId=${company.id}`)).find(item => item.id === invoice.id).status, 'PAID');
  });

  await t.test('leave requests, balances and advances connect employees with administrators', async () => {
    const reportingOptions = await request('GET', `/leave/reporting-to?companyId=${company.id}&branchId=${branch.id}`, undefined, 'employee');
    assert.ok(reportingOptions.some(person => person.id === manager.id && person.position === 'BRANCH_MANAGER'));
    assert.ok(reportingOptions.some(person => person.id === owner.id && person.position === 'BUSINESS_OWNER'));
    assert.ok(reportingOptions.every(person => person.id !== employee.id && Object.keys(person).sort().join(',') === 'id,name,position'));
    await request('GET', `/leave/reporting-to?companyId=${otherCompany.id}&branchId=${otherBranch.id}`, undefined, 'employee', 403);
    const type = await request('POST', '/leave/types', { companyId: company.id, code: 'TEST_CL', name: 'Test leave', annualAllowance: 12, isPaid: true }, 'hr');
    await request('POST', '/leave/balances/allocate', { companyId: company.id, branchId: branch.id, userId: employee.id, leaveTypeId: type.id, year: leaveYear, allocatedDays: 12 }, 'hr');
    const leaveBody = { companyId: company.id, branchId: branch.id, leaveTypeId: type.id, startDate: leaveDate, endDate: leaveDate, reason: 'Test leave request' };
    await request('POST', '/leave/requests', { ...leaveBody, reportingToId: employee.id }, 'employee', 400);
    await prisma.user.update({ where: { id: manager.id }, data: { status: 'INACTIVE' } });
    await request('POST', '/leave/requests', { ...leaveBody, reportingToId: manager.id }, 'employee', 400);
    await prisma.user.update({ where: { id: manager.id }, data: { status: 'ACTIVE' } });
    const leave = await request('POST', '/leave/requests', { ...leaveBody, reportingToId: manager.id }, 'employee');
    assert.equal(leave.reportingToId, manager.id);
    assert.equal(leave.reportingTo.name, manager.name);
    const myLeave = await request('GET', `/leave/requests/my?companyId=${company.id}&branchId=${branch.id}`, undefined, 'employee');
    assert.equal(myLeave.data.find(item => item.id === leave.id).reportingTo.id, manager.id);
    await request('PATCH', `/leave/requests/${leave.id}/approve`, { note: 'Approved for test' }, 'hr');
    const balances = await request('GET', `/leave/balances/my?companyId=${company.id}&branchId=${branch.id}&year=${leaveYear}`, undefined, 'employee');
    assert.ok(balances.some(balance => Number(balance.usedDays) === 1));
    const advance = await request('POST', '/advances', { companyId: company.id, branchId: branch.id, amount: '1000', reason: 'Test advance request' }, 'employee');
    await request('PATCH', `/advances/${advance.id}/approve`, { note: 'Approved for test' }, 'hr');
    const mine = await request('GET', '/advances/my', undefined, 'employee'); assert.ok(mine.some(record => record.id === advance.id && record.status === 'APPROVED'));
  });

  await t.test('salary assignment, payroll approval, payment and employee payslips integrate', async () => {
    const structure = await request('POST', '/payroll/salary-structures', { companyId: company.id, name: 'Test monthly salary', basicAmount: '30000', components: [{ code: 'DEDUCT', name: 'Test deduction', kind: 'DEDUCTION', amount: '1000' }] }, 'payroll');
    await request('POST', '/payroll/employee-salaries', { companyId: company.id, branchId: branch.id, userId: employee.id, structureId: structure.id, effectiveFrom: '2026-01-01' });
    const period = await request('POST', '/payroll/periods', { companyId: company.id, branchId: branch.id, year: 2026, month: 9 });
    const incentive = await request('POST', '/payroll/incentives', { companyId: company.id, branchId: branch.id, userId: employee.id, year: 2026, month: 9, amount: '500.00', description: 'September sales incentive' }, 'payroll');
    assert.equal(Number(incentive.amount), 500);
    assert.ok((await request('GET', `/payroll/incentives?companyId=${company.id}&branchId=${branch.id}&year=2026&month=9`, undefined, 'payroll')).some(item => item.id === incentive.id));
    let run = await request('POST', `/payroll/periods/${period.id}/calculate`, {});
    assert.equal(run.entries.length, 1); assert.equal(Number(run.entries[0].grossAmount), 30500); assert.equal(Number(run.entries[0].netAmount), 29500);
    await request('POST', `/payroll/runs/${run.id}/approve`, {}, 'owner', 403);
    await request('POST', `/payroll/runs/${run.id}/approve`, {}, 'payroll', 403);
    await request('POST', `/payroll/runs/${run.id}/return`, { reason: 'Unauthorized payroll return' }, 'payroll', 403);
    const returned = await request('POST', `/payroll/runs/${run.id}/return`, { reason: 'Recheck the salary inputs before approval' }, 'manager');
    assert.equal(returned.status, 'DRAFT'); assert.equal(returned.entries.length, 0);
    const returnedPeriods = await request('GET', `/payroll/periods?companyId=${company.id}&branchId=${branch.id}`, undefined, 'payroll');
    assert.equal(returnedPeriods.find(item => item.id === period.id).run.returnReason, 'Recheck the salary inputs before approval');
    await request('POST', `/payroll/runs/${run.id}/publish`, {}, 'manager', 403);
    run = await request('POST', `/payroll/periods/${period.id}/calculate`, {}, 'payroll');
    await request('POST', `/payroll/runs/${run.id}/approve`, {}, 'manager');
    await request('POST', `/payroll/runs/${run.id}/publish`, {});
    await request('POST', `/payroll/runs/${run.id}/return`, { reason: 'Published payroll cannot be returned' }, 'manager', 409);
    await request('POST', `/payroll/entries/${run.entries[0].id}/pay`, { method: 'BANK_TRANSFER', reference: 'TEST-PAYMENT' });
    const payslips = await request('GET', '/payroll/my-payslips', undefined, 'employee');
    assert.ok(payslips.some(entry => entry.id === run.entries[0].id && Number(entry.netAmount) === 29500));
  });

  await t.test('employee form limits and administrative access restrictions are enforced by the API', async () => {
    const before = await prisma.salaryAdvance.count({ where: { tenantId } });
    for (const amount of ['0', '-1', '1.999', 'abc', '1000000000000'])
      await request('POST', '/advances', { companyId: company.id, branchId: branch.id, amount, reason: 'Invalid amount test' }, 'employee', 400);
    for (const reason of ['', '  ', 'x'.repeat(1001)])
      await request('POST', '/advances', { companyId: company.id, branchId: branch.id, amount: '1000', reason }, 'employee', 400);
    assert.equal(await prisma.salaryAdvance.count({ where: { tenantId } }), before);
    await request('GET', '/users', undefined, 'employee', 403);
    await request('POST', `/users/${employee.id}/roles`, { role: 'BUSINESS_ADMIN' }, 'employee', 403);
    await request('POST', '/employee-documents', { companyId: company.id, branchId: branch.id, employeeId: employee.id, title: 'Self issued', kind: 'LETTER', content: 'Invalid self-issued letter' }, 'employee', 403);
    const privateTask = await request('POST', '/tasks', { companyId: company.id, branchId: branch.id, assignedToId: owner.id, title: 'Private administrator task' });
    await request('GET', `/tasks/${privateTask.id}`, undefined, 'employee', 403);
    await request('PATCH', `/tasks/${privateTask.id}/status`, { status: 'COMPLETED' }, 'employee', 403);
    await request('POST', `/tasks/${privateTask.id}/comments`, { message: 'Must be rejected' }, 'employee', 403);
  });

  await t.test('role panels use scoped HR onboarding, sales tasks and manager payroll review', async () => {
    const companyManager = await createUser('COMPANY_MANAGER');
    const sales = await createUser('SALES_MANAGER');
    await prisma.userBranchAccess.deleteMany({ where: { userId: companyManager.id, branchId: secondBranch.id } });
    for (const [key, person] of Object.entries({ companyManager, sales })) {
      tokens[key] = (await request('POST', '/auth/login', { email: person.email, password, portal: 'staff' })).accessToken;
    }
    const me = await request('GET', '/auth/me', undefined, 'companyManager');
    assert.ok(me.memberships.some(item => item.role === 'COMPANY_MANAGER'));
    const managers = await request('GET', `/employees/reporting-managers?companyId=${company.id}`, undefined, 'hr');
    assert.ok(managers.some(item => item.id === companyManager.id));
    assert.ok(managers.every(item => !('password' in item) && !('bankEnding' in item)));
    await request('GET', `/departments?companyId=${company.id}`, undefined, 'hr');
    await request('POST', '/departments', { companyId: company.id, name: 'Unauthorized department' }, 'hr', 403);
    const person = await request('POST', '/employees/onboard', { companyId: company.id, branchId: branch.id,
      name: 'HR onboarded teammate', email: `hr-onboard-${tenantId}@example.invalid`, password, loginEnabled: true,
      joiningDate: '2026-01-01', gross: '1000', deductions: '0', bankEnding: '4321',
    }, 'hr');
    await request('PATCH', `/employees/${person.id}`, { designation: 'HR maintained title' }, 'hr');
    await request('PATCH', `/employees/${person.id}`, { designation: 'Forbidden manager edit' }, 'manager', 403);
    await request('GET', `/employees?companyId=${company.id}`, undefined, 'sales', 403);
    const assignees = await request('GET', `/tasks/assignees?companyId=${company.id}`, undefined, 'sales');
    assert.ok(assignees.some(item => item.userId === person.userId));
    assert.ok(assignees.every(item => !('bankEnding' in item) && !('email' in item.user)));
    const task = await request('POST', '/tasks', { companyId: company.id, branchId: branch.id,
      title: 'Sales assigned follow-up', assignedToId: person.userId, priority: 'MEDIUM',
    }, 'sales');
    await request('PATCH', `/tasks/${task.id}`, { title: 'Manager reviewed follow-up' }, 'companyManager');
    await request('POST', '/tasks', { companyId: company.id, branchId: branch.id, title: 'Forbidden HR task', assignedToId: person.userId }, 'hr', 403);
    await request('POST', '/tasks', { companyId: otherCompany.id, branchId: otherBranch.id, title: 'Forbidden foreign task', assignedToId: person.userId }, 'sales', 403);
    assert.equal((await request('GET', `/tasks?companyId=${otherCompany.id}`, undefined, 'sales')).length, 0);
    tokens.hrOnboarded = (await request('POST', '/auth/login', { email: `hr-onboard-${tenantId}@example.invalid`, password, portal: 'employee' })).accessToken;
    await request('PATCH', `/tasks/${task.id}/status`, { status: 'COMPLETED' }, 'hrOnboarded');
    await request('PATCH', `/tasks/${task.id}`, { title: 'Forbidden employee reassignment' }, 'hrOnboarded', 403);
    await request('GET', `/payroll/periods?companyId=${company.id}&branchId=${branch.id}`, undefined, 'companyManager');
    await request('GET', `/payroll/periods?companyId=${company.id}&branchId=${secondBranch.id}`, undefined, 'companyManager', 403);
    await request('POST', '/payroll/periods', { companyId: company.id, branchId: branch.id, year: 2027, month: 8 }, 'companyManager', 403);
    await request('GET', `/attendance?companyId=${company.id}&branchId=${branch.id}`, undefined, 'payroll');
    for (const role of ['companyManager', 'sales', 'hr', 'payroll']) {
      await request('GET', '/payroll/my-payslips', undefined, role);
      await request('GET', '/employee-documents/my', undefined, role);
    }
  });

  await t.test('atomic onboarding, attendance proration, advance recovery and historical company snapshots', async () => {
    const payrollCompany = await prisma.company.create({ data: { tenantId, name: 'Payroll integration company' } });
    const payrollBranch = await prisma.branch.create({ data: { companyId: payrollCompany.id, name: 'Payroll branch', code: 'PAYROLL_INT' } });
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit' }).formatToParts(new Date());
    const year = Number(parts.find(item => item.type === 'year').value), month = Number(parts.find(item => item.type === 'month').value);
    const key = `${year}-${String(month).padStart(2, '0')}`, joined = `${key}-16`;
    const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const body = { companyId: payrollCompany.id, branchId: payrollBranch.id, name: 'Snapshot Employee', email: `payroll-person-${tenantId}@example.invalid`, joiningDate: joined, password, loginEnabled: true, gross: '31000', deductions: '3100', bankName: 'Test bank', bankEnding: '1234', bankIfsc: 'TEST0123456', department: 'Original department', designation: 'Original designation' };
    const employeeService = app.get(require('../dist/modules/employees/employees.service').EmployeesService);
    const before = (await prisma.company.findUniqueOrThrow({ where: { id: payrollCompany.id } })).employeeIdNext;
    // Force a database salary overflow after account, grants and profile creation.
    await assert.rejects(employeeService.onboard({ id: owner.id, tenantId, roles: ['BUSINESS_OWNER'] }, { ...body, gross: '1000000000000' }));
    assert.equal(await prisma.user.count({ where: { email: body.email } }), 0);
    assert.equal(await prisma.employeeProfile.count({ where: { companyId: payrollCompany.id } }), 0);
    assert.equal((await prisma.company.findUniqueOrThrow({ where: { id: payrollCompany.id } })).employeeIdNext, before);
    const profile = await request('POST', '/employees/onboard', body);
    assert.equal(profile.bankEnding, '1234');
    await request('POST', '/employees/onboard', body, 'owner', 409);
    await request('POST', '/employees/onboard', { ...body, email: `forbidden-${tenantId}@example.invalid` }, 'employee', 403);
    const login = await request('POST', '/auth/login', { email: body.email, password, portal: 'employee' }); tokens.snapshotEmployee = login.accessToken;
    const checker = await prisma.user.create({ data: { tenantId, name: 'Payroll checker', email: `checker-${tenantId}@example.invalid`, password: await bcrypt.hash(password, 4), roles: { create: { role: { connect: { name: 'COMPANY_MANAGER' } } } }, companyAccess: { create: [{ companyId: payrollCompany.id }, { companyId: otherCompany.id }] }, branchAccess: { create: [{ branchId: payrollBranch.id }, { branchId: otherBranch.id }] } } });
    tokens.snapshotChecker = (await request('POST', '/auth/login', { email: checker.email, password, portal: 'staff' })).accessToken;
    await request('PATCH', `/companies/${payrollCompany.id}/payslip-settings`, { version: 1, address: 'Original address', accentColor: '#224466', showBankDetails: true, showPaidDays: true, footer: 'Company original footer' });
    await request('PATCH', `/companies/${payrollCompany.id}/payslip-settings`, { version: 1, address: 'Stale write' }, 'owner', 409);
    await request('PATCH', `/companies/${payrollCompany.id}/payroll-calendar`, { weeklyOffDays: [0], holidays: [`${key}-17`] });
    const companyRead = await request('GET', `/companies/${payrollCompany.id}`);
    assert.equal(companyRead.payslipSettings.address, 'Original address');
    assert.equal(companyRead.payslipSettingsVersion, 2);
    assert.deepEqual(companyRead.payrollCalendar.weeklyOffDays, [0]);
    const listed = (await request('GET', '/companies')).find(item => item.id === payrollCompany.id);
    assert.equal(listed.payslipSettings.address, 'Original address');
    await request('POST', '/payroll/policies', { companyId: payrollCompany.id, mode: 'ATTENDANCE_BASED', effectiveFrom: `${key}-01` });
    const workdays = Array.from({ length: days - 15 }, (_, index) => `${key}-${String(index + 16).padStart(2, '0')}`).filter(value => new Date(value + 'T00:00:00Z').getUTCDay() !== 0 && !value.endsWith('-17'));
    const [absent, half, unpaid, missing] = workdays;
    await prisma.attendance.createMany({ data: workdays.filter(value => value !== unpaid && value !== missing).map(value => ({ tenantId, companyId: payrollCompany.id, branchId: payrollBranch.id, userId: profile.userId, attendanceDate: new Date(value), source: 'MANUAL', status: value === absent ? 'ABSENT' : value === half ? 'HALF_DAY' : 'PRESENT' })) });
    const leaveType = await request('POST', '/leave/types', { companyId: payrollCompany.id, code: 'UNPAID', name: 'Unpaid', annualAllowance: 0, isPaid: false });
    await prisma.leaveRequest.create({ data: { tenantId, companyId: payrollCompany.id, branchId: payrollBranch.id, userId: profile.userId, leaveTypeId: leaveType.id, startDate: new Date(unpaid), endDate: new Date(unpaid), days: 1, reason: 'Payroll fixture leave', status: 'APPROVED' } });
    const advance = await request('POST', '/advances', { companyId: payrollCompany.id, branchId: payrollBranch.id, amount: '3000', reason: 'Recovery integration advance' }, 'snapshotEmployee');
    await request('PATCH', `/advances/${advance.id}/approve`, {});
    const period = await request('POST', '/payroll/periods', { companyId: payrollCompany.id, branchId: payrollBranch.id, year, month });
    await request('POST', `/payroll/periods/${period.id}/calculate`, {}, 'owner', 409);
    await prisma.attendance.create({ data: { tenantId, companyId: payrollCompany.id, branchId: payrollBranch.id, userId: profile.userId, attendanceDate: new Date(missing), source: 'MANUAL', status: 'PRESENT' } });
    let run = await request('POST', `/payroll/periods/${period.id}/calculate`, {});
    assert.equal(Number(run.entries[0].paidDays), days - 15 - 2.5);
    assert.ok(!run.entries[0].components.some(item => item.code === 'ADVANCE_RECOVERY'), 'Approval alone does not trigger recovery');
    const payout = { reference: 'BANK-PAYOUT-TEST', recoveryMonthly: '1000', recoveryStart: key };
    await request('POST', `/advances/${advance.id}/disburse`, { ...payout, recoveryMonthly: '4000' }, 'owner', 400);
    await request('POST', `/advances/${advance.id}/disburse`, payout);
    await request('POST', `/advances/${advance.id}/disburse`, payout, 'owner', 409);
    run = await request('POST', `/payroll/periods/${period.id}/calculate`, {});
    const expectedGross = new (require('@prisma/client').Prisma.Decimal)(31000).mul(days - 15 - 2.5).div(days).toDecimalPlaces(2);
    assert.equal(Number(run.entries[0].grossAmount), Number(expectedGross));
    assert.equal(Number(run.entries[0].components.find(item => item.code === 'ADVANCE_RECOVERY').amount), 1000);
    run = await request('POST', `/payroll/periods/${period.id}/calculate`, {});
    assert.equal(await prisma.payrollAdvanceRecovery.count({ where: { advanceId: advance.id } }), 1, 'Recalculation replaces the deduction rather than duplicating it');
    await request('POST', `/payroll/runs/${run.id}/approve`, {}, 'snapshotChecker');
    await request('POST', `/payroll/runs/${run.id}/publish`, {});
    await request('POST', `/payroll/entries/${run.entries[0].id}/pay`, { method: 'BANK_TRANSFER', reference: 'PAYROLL-SETTLED' });
    await request('PATCH', `/companies/${payrollCompany.id}/payslip-settings`, { version: 2, address: 'New address', accentColor: '#11786D' });
    await request('PATCH', `/employees/${profile.id}`, { designation: 'Changed designation', bankEnding: '9999' });
    let slips = await request('GET', '/payroll/my-payslips', undefined, 'snapshotEmployee');
    const original = slips.find(item => item.id === run.entries[0].id);
    assert.equal(original.identitySnapshot.designation, 'Original designation');
    assert.equal(original.identitySnapshot.bankAccount, 'XXXX1234');
    assert.equal(original.identitySnapshot.settings.address, 'Original address');
    const additional = await request('POST', '/employees', { companyId: otherCompany.id, branchId: otherBranch.id, userId: profile.userId, joiningDate: `${key}-01` });
    const structure = await request('POST', '/payroll/salary-structures', { companyId: otherCompany.id, name: 'Second-company salary ' + tenantId, basicAmount: '9900', components: [] });
    await request('POST', '/payroll/employee-salaries', { companyId: otherCompany.id, branchId: otherBranch.id, userId: profile.userId, structureId: structure.id, effectiveFrom: `${key}-01` });
    const second = await request('POST', '/payroll/periods', { companyId: otherCompany.id, branchId: otherBranch.id, year, month });
    const secondRun = await request('POST', `/payroll/periods/${second.id}/calculate`, {});
    await request('POST', `/payroll/runs/${secondRun.id}/approve`, {}, 'snapshotChecker'); await request('POST', `/payroll/runs/${secondRun.id}/publish`, {});
    slips = await request('GET', '/payroll/my-payslips', undefined, 'snapshotEmployee');
    assert.equal(slips.filter(item => item.run.period.year === year && item.run.period.month === month).length, 2);
    assert.equal(slips.find(item => item.id === secondRun.entries[0].id).identitySnapshot.employeeId, additional.employeeCode);
    assert.equal(slips.find(item => item.id === secondRun.entries[0].id).identitySnapshot.companyId, otherCompany.id);
    const schedule = (await request('GET', `/advances?companyId=${payrollCompany.id}&branchId=${payrollBranch.id}`)).find(item => item.id === advance.id);
    assert.equal(Number(schedule.recoveries[0].amount), 1000); assert.ok(schedule.recoveries[0].entry.payment);
    const nextMonth = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
    await request('POST', '/payroll/policies', { companyId: payrollCompany.id, mode: 'FIXED', effectiveFrom: nextMonth });
    for (let offset = 1; offset <= 3; offset++) {
      const date = new Date(Date.UTC(year, month - 1 + offset, 1));
      const futurePeriod = await request('POST', '/payroll/periods', { companyId: payrollCompany.id, branchId: payrollBranch.id, year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 });
      const futureRun = await request('POST', `/payroll/periods/${futurePeriod.id}/calculate`, {});
      const recovery = futureRun.entries[0].components.find(item => item.code === 'ADVANCE_RECOVERY');
      assert.equal(Number(recovery?.amount ?? 0), offset <= 2 ? 1000 : 0, 'Recovery stops once the original advance is fully scheduled');
    }
    const totalRecovery = await prisma.payrollAdvanceRecovery.aggregate({ where: { advanceId: advance.id }, _sum: { amount: true } });
    assert.equal(Number(totalRecovery._sum.amount), 3000);
  });

  if (process.env.RUN_BROWSER_AUDIT === '1') await t.test('all screens render without runtime errors or horizontal overflow', { timeout: 480000 }, async () => {
    const fs = require('node:fs/promises');
    const path = require('node:path');
    const root = path.resolve(__dirname, '../../frontend/dist');
    const server = require('node:http').createServer(async (incoming, outgoing) => {
      try {
        const requested = path.resolve(root, '.' + new URL(incoming.url, 'http://localhost').pathname);
        if (requested !== root && !requested.startsWith(root + path.sep)) { outgoing.writeHead(403).end(); return; }
        let file = requested;
        try { if (!(await fs.stat(file)).isFile()) file = path.join(root, 'index.html'); } catch { file = path.join(root, 'index.html'); }
        const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.ttf': 'font/ttf', '.png': 'image/png', '.svg': 'image/svg+xml' };
        const content = await fs.readFile(file);
        outgoing.writeHead(200, { 'content-type': mime[path.extname(file)] ?? 'application/octet-stream' }); outgoing.end(content);
      } catch { if (!outgoing.headersSent) outgoing.writeHead(500); outgoing.end(); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(async () => { if (server.listening) await new Promise(resolve => server.close(resolve)); });
    const origin = `http://127.0.0.1:${server.address().port}`;
    const { chromium } = require('../../frontend/node_modules/@playwright/test');
    const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
    try {
      const errors = [];
      const output = path.join(root, 'audit'); await fs.mkdir(output, { recursive: true });
      const routes = {
        owner: ['/admin/dashboard', '/admin/crm', '/admin/crm/leads', '/admin/crm/lead-form', `/admin/crm/lead/${lead.id}`, '/admin/crm/deals-live', `/admin/crm/deals/${deal.id}`, '/admin/crm/quotes-live', `/admin/crm/quotes/${quote.id}`, '/admin/crm/customers-live', '/admin/crm/activities', '/admin/employees', '/admin/employees/people', '/admin/employees/create', '/admin/attendance', '/admin/attendance/team', '/admin/attendance/corrections', '/admin/leave-management', '/admin/approvals', '/admin/tasks', '/admin/tasks/follow-ups', '/admin/payroll', '/admin/salary', '/admin/reports', '/admin/branches', '/admin/roles-permissions', '/admin/activity-audit', '/admin/profile', '/admin/workspace-settings', '/admin/more'],
        employee: ['/employee/dashboard', '/employee/attendance', '/employee/leave', '/employee/tasks', '/employee/payslips', '/employee/advances', '/employee/profile', '/employee/documents', '/employee/help'],
        hr: ['/admin/dashboard', '/admin/employees', '/admin/attendance/team', '/admin/leave-management', '/admin/approvals', '/admin/reports'],
        payroll: ['/admin/dashboard', '/admin/employees', '/admin/payroll', '/admin/advances', '/admin/reports'],
      };
      routes.owner.push('/admin/payslips', '/admin/advances', '/admin/billing', '/admin/subscription', '/admin/platform-support', '/admin/profile/documents');
      routes.owner.push(`/admin/employees/${employeeProfile.id}`, `/admin/employees/${employeeProfile.id}/edit`);
      const employeeOnly = process.env.BROWSER_EMPLOYEE_ONLY === '1';
      const webLayoutOnly = process.env.BROWSER_WEB_LAYOUT_ONLY === '1';
      const floatingInputs = process.env.BROWSER_FLOATING_INPUTS === '1';
      const navigationResponse = process.env.BROWSER_NAVIGATION_RESPONSE === '1';
      const accessForm = process.env.BROWSER_ACCESS_FORM === '1';
      const numberingSettings = process.env.BROWSER_NUMBERING_SETTINGS === '1';
      const employeeTasks = await request('GET', '/tasks/my', undefined, 'employee');
      if (employeeTasks.length) routes.employee.push(`/employee/tasks/${employeeTasks[0].id}`);
      if (process.env.BROWSER_AUDIT_FOCUS === '1') {
        routes.owner = ['/admin/dashboard', '/admin/crm', '/admin/crm/lead-form', '/admin/crm/deals-live', '/admin/crm/quotes-live', '/admin/crm/customers-live', '/admin/employees', `/admin/employees/${employeeProfile.id}`, `/admin/employees/${employeeProfile.id}/edit`, '/admin/payroll', '/admin/advances', '/admin/reports', '/admin/subscription'];
        routes.employee = ['/employee/dashboard', '/employee/attendance', '/employee/leave', '/employee/payslips', '/employee/help'];
      }
      if (process.env.BROWSER_UX_FOCUS === '1') {
        routes.owner = ['/admin/dashboard', '/admin/employees', '/admin/employees/create', '/admin/crm/deals-live', '/admin/crm/customers-live', '/admin/crm/quotes-live', '/admin/billing', '/admin/branches', '/admin/roles-permissions', '/admin/workspace-settings', '/admin/payroll'];
        routes.employee = ['/employee/dashboard', '/employee/leave', '/employee/tasks'];
      }
      const leaveOnly = process.env.BROWSER_LEAVE_ONLY === '1';
      if (leaveOnly) routes.owner = ['/admin/attendance'];
      for (const role of numberingSettings ? ['owner'] : accessForm ? ['owner', 'approver'] : navigationResponse ? ['owner'] : floatingInputs ? ['owner', 'employee'] : employeeOnly ? ['employee'] : leaveOnly ? ['owner'] : ['owner', 'employee', 'hr', 'payroll']) {
        const context = await browser.newContext();
        await context.addInitScript(token => sessionStorage.setItem('branchsuite_access_token', token), tokens[role]);
        await context.route('**/api/v1/**', async route => {
          const incoming = route.request();
          const url = new URL(incoming.url());
          const headers = incoming.headers(); delete headers.host; delete headers['content-length'];
          const result = await app.inject({ method: incoming.method(), url: url.pathname + url.search, headers, payload: incoming.postData() ?? undefined });
          if (result.statusCode >= 400) errors.push(`${role}: ${incoming.method()} ${url.pathname}: ${result.statusCode} ${result.body.slice(0, 160)}`);
          await route.fulfill({ status: result.statusCode, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: result.body });
        });
        const page = await context.newPage();
        page.on('pageerror', error => errors.push(`${role}: ${error.message}`));
        if (numberingSettings) {
          for (const width of [1440, 768, 390]) {
            await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
            await page.goto(origin + '/admin/workspace-settings', { waitUntil: 'networkidle' });
            await page.getByLabel('Employee ID prefix', { exact: true }).fill('staff');
            await page.getByLabel('Next employee number', { exact: true }).fill('50');
            await page.getByText('Preview: STAFF-050', { exact: true }).first().waitFor();
            await page.getByRole('button', { name: 'Save employee numbering', exact: true }).click();
            await page.getByText('Employee numbering saved.', { exact: true }).first().waitFor();
            const settings = await prisma.company.findUniqueOrThrow({ where: { id: company.id } });
            assert.equal(settings.employeeIdPrefix, 'STAFF');
            assert.equal(settings.employeeIdNext, 50);
            const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2);
            assert.equal(overflow, false, 'Numbering settings should fit ' + width + 'px');
            await page.getByLabel('Employee ID prefix', { exact: true }).scrollIntoViewIfNeeded();
            await page.screenshot({ path: path.join(output, 'employee-numbering-' + width + '.png'), fullPage: true });
          }
          await context.close();
          console.log('Employee numbering settings: prefix, preview, persistence and responsive layout checked');
          continue;
        }
        if (accessForm) {
          for (const width of [1440, 768, 390]) {
            await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
            await page.goto(`${origin}/admin/roles-permissions`, { waitUntil: 'networkidle' });
            await page.getByRole('button', { name: 'Create user', exact: true }).click();
            const create = page.getByRole('button', { name: 'Create user account', exact: true });
            await create.click();
            await page.getByText('Enter the user’s full name.', { exact: true }).first().waitFor();
            await page.getByText('Enter a valid work email address.', { exact: true }).first().waitFor();
            const name = `Browser ${role} user ${width}`;
            const email = `access-form-${role}-${width}-${tenantId}@example.invalid`;
            await page.getByLabel('Full name', { exact: true }).fill(name);
            await page.getByLabel('Work email', { exact: true }).fill(owner.email.toUpperCase());
            await page.getByRole('button', { name: 'User role', exact: true }).click();
            assert.equal(await page.getByRole('button', { name: 'Business Admin', exact: true }).count(), role === 'owner' ? 1 : 0);
            await page.getByRole('button', { name: 'HR Manager', exact: true }).click();
            await page.getByText('A user with this email already exists.', { exact: true }).first().waitFor();

            await page.getByLabel('Work email', { exact: true }).fill(email);
            await page.getByRole('button', { name: 'Branch access', exact: true }).click();
            const north = page.getByRole('checkbox', { name: 'Branch access: Test North', exact: true });
            const south = page.getByRole('checkbox', { name: 'Branch access: Test South', exact: true });
            if (await north.getAttribute('aria-checked') === 'true') {
              await north.click();
              await page.getByRole('button', { name: 'Branch access', exact: true }).click();
            }
            if (await south.getAttribute('aria-checked') === 'true') {
              await south.click();
              await page.getByRole('button', { name: 'Branch access', exact: true }).click();
            }
            await create.click();
            await page.getByText('Select at least one branch.', { exact: true }).first().waitFor();
            await south.click();
            const overflow = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
            assert.ok(overflow.scroll <= overflow.width + 2, `User form overflows at ${width}px`);
            await page.getByLabel('Full name', { exact: true }).scrollIntoViewIfNeeded();
            await page.screenshot({ path: path.join(output, `create-user-${role}-${width}.png`), fullPage: true, animations: 'disabled' });
            if (width !== 390) {
              await page.getByRole('button', { name: 'Cancel', exact: true }).click();
              await page.getByLabel('Work email', { exact: true }).waitFor({ state: 'hidden' });
              continue;
            }
            // Failed creation should preserve the user's inputs for correction.
            await page.route('**/api/v1/users', async route => {
              if (route.request().method() === 'POST') await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ message: 'This email is already in use.' }) });
              else await route.fallback();
            });
            await create.click();
            await page.getByText('This email is already in use.', { exact: true }).first().waitFor();
            assert.equal(await page.getByText('This email is already in use.', { exact: true }).evaluate(element => { const bounds = element.getBoundingClientRect(); return bounds.top >= 0 && bounds.bottom <= innerHeight; }), true, 'Save errors must remain visible without scrolling.');
            assert.equal(await page.getByLabel('Full name', { exact: true }).inputValue(), name);
            assert.equal(await page.getByLabel('Work email', { exact: true }).inputValue(), email);
            await page.getByRole('button', { name: 'Branch access', exact: true }).click();
            assert.equal(await page.getByRole('checkbox', { name: 'Branch access: Test South', exact: true }).getAttribute('aria-checked'), 'true');
            await page.getByRole('button', { name: 'Branch access', exact: true }).click();
            await page.unroute('**/api/v1/users');
            await create.click();
            await page.getByLabel('Work email', { exact: true }).waitFor({ state: 'hidden' });
            await page.getByText(`${name} was added. They can use Forgot password to set their password.`, { exact: true }).first().waitFor();
            const saved = await prisma.user.findUniqueOrThrow({ where: { email }, include: { roles: { include: { role: true } }, branchAccess: true } });
            assert.deepEqual(saved.roles.map(item => item.role.name), ['HR_MANAGER']);
            assert.deepEqual(saved.branchAccess.map(item => item.branchId), [secondBranch.id]);
          }
          process.stdout.write(`Create user form: ${role}, validation, roles, branches, failed-save recovery and persisted creation checked at 390/768/1440px\n`);
          await context.close();
          continue;
        }
        if (navigationResponse) {
          await page.setViewportSize({ width: 390, height: 844 });
          await page.goto(`${origin}/admin/dashboard`, { waitUntil: 'networkidle' });
          const bar = await page.getByLabel('Admin bottom navigation', { exact: true }).elementHandle();
          const timings = [];
          for (const [label, destination] of [['CRM', '/admin/crm'], ['People', '/admin/employees/people'], ['Payroll', '/admin/payroll'], ['More', '/admin/more'], ['Home', '/admin/dashboard'], ['CRM', '/admin/crm'], ['People', '/admin/employees/people']]) {
            const started = performance.now();
            await page.getByRole('button', { name: label, exact: true }).click();
            await page.waitForURL(`**${destination}`);
            await page.getByRole('button', { name: label, exact: true }).getAttribute('aria-selected').then(selected => assert.equal(selected, 'true'));
            timings.push(`${label}: ${Math.round(performance.now() - started)}ms`);
            assert.equal(await bar.evaluate(element => element.isConnected), true, 'The bottom navigation must survive page changes.');
            assert.equal(await page.getByLabel('Admin bottom navigation', { exact: true }).count(), 1);
            await page.waitForLoadState('networkidle');
          }
          process.stdout.write(`Persistent tab navigation: ${timings.join(', ')}\n`);
          // Moving the bar out of pages must preserve their save-in-progress lock.
          await page.goto(`${origin}/admin/crm/lead-form`, { waitUntil: 'networkidle' });
          await page.getByLabel('Organisation *', { exact: true }).fill('Persistent navigation test lead');
          await page.getByLabel('Contact person *', { exact: true }).fill('Navigation test contact');
          await page.getByLabel('Email *', { exact: true }).fill('navigation@example.invalid');
          await page.getByLabel('Phone *', { exact: true }).fill('9876543210');
          await page.getByLabel(/Estimated value/).fill('1000');
          let releaseSave;
          let saveStarted;
          const saveGate = new Promise(resolve => { releaseSave = resolve; });
          const observedSave = new Promise(resolve => { saveStarted = resolve; });
          await page.route('**/api/v1/leads', async route => {
            if (route.request().method() === 'POST') { saveStarted(); await saveGate; }
            await route.fallback();
          });
          try {
            await page.getByRole('button', { name: 'Create lead', exact: true }).click();
            await observedSave;
            await page.waitForFunction(() => document.querySelector('[aria-label="Admin bottom navigation"] [aria-label="Home"]')?.getAttribute('aria-disabled') === 'true');
          } finally { releaseSave(); }
          await page.waitForURL(/\/admin\/crm\/deals-live/, { timeout: 15000 });
          await page.waitForFunction(() => document.querySelector('[aria-label="Admin bottom navigation"] [aria-label="Home"]')?.getAttribute('aria-disabled') !== 'true');
          process.stdout.write('Persistent navigation: save lock and unlock checked\n');
          await context.close();
          continue;
        }
        if (webLayoutOnly || floatingInputs) page.on('console', message => { if (message.type() === 'error') process.stdout.write(`Browser console ${role}: ${message.text()}\n`); });
        if (leaveOnly) {
          for (const [index, width] of [390, 1440].entries()) {
            await page.setViewportSize({ width, height: 900 });
            await page.goto(`${origin}/admin/attendance`, { waitUntil: 'networkidle' });
            await page.getByRole('button', { name: 'Choose branch', exact: true }).filter({ hasText: 'Selected branch' }).click();
            await page.getByText('Test South', { exact: true }).click();
            await page.getByRole('button', { name: 'Apply leave', exact: true }).click();
            await page.getByRole('button', { name: 'Submit Request', exact: true }).waitFor({ state: 'visible' });
            assert.equal(new URL(page.url()).searchParams.get('branchId'), secondBranch.id);
            const date = new Date(Date.now() + (20 + index) * 86400000).toISOString().slice(0, 10);
            await page.getByLabel('Start date', { exact: true }).fill(date);
            await page.getByLabel('End date', { exact: true }).fill(date);
            const reason = `Attendance leave regression ${width}`;
            await page.getByLabel('Reason for leave', { exact: true }).fill(reason);
            const saved = page.waitForResponse(response => response.url().includes('/leave/requests') && response.request().method() === 'POST');
            await page.getByRole('button', { name: 'Submit Request', exact: true }).click();
            assert.equal((await saved).status(), 201);
            await page.getByText('Leave request submitted successfully.', { exact: false }).first().waitFor({ state: 'visible' });
            const created = await prisma.leaveRequest.findFirstOrThrow({ where: { tenantId, userId: owner.id, reason } });
            assert.equal(created.branchId, secondBranch.id);
            assert.equal(created.status, 'PENDING');
            process.stdout.write(`Attendance Apply leave: ${width}px form and submission checked\n`);
          }
          // A supplementary balance failure must not disable an otherwise valid application.
          await context.route('**/api/v1/leave/balances/my?**', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Balance temporarily unavailable' }) }));
          await page.goto(`${origin}/admin/attendance?view=leave&apply=1&branchId=${secondBranch.id}`, { waitUntil: 'networkidle' });
          await page.getByRole('button', { name: 'Submit Request', exact: true }).waitFor({ state: 'visible' });
          await page.getByRole('button', { name: 'Close', exact: true }).click();
          await page.getByRole('button', { name: '+ Apply', exact: true }).click();
          await page.getByRole('button', { name: 'Submit Request', exact: true }).waitFor({ state: 'visible' });
          await context.unroute('**/api/v1/leave/balances/my?**');
          await context.route('**/api/v1/leave/types?**', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Leave service temporarily unavailable' }) }));
          await page.goto(`${origin}/admin/attendance?view=leave&apply=1`, { waitUntil: 'networkidle' });
          await page.getByText('Leave types: Leave service temporarily unavailable', { exact: true }).first().waitFor({ state: 'visible' });
          assert.equal(await page.getByRole('button', { name: 'Set up leave types', exact: true }).count(), 0);
          await context.unroute('**/api/v1/leave/types?**');

          // A genuinely unconfigured company can set its own policy and return to apply.
          const setupCompany = await prisma.company.create({ data: { tenantId, name: 'Leave setup company' } });
          const setupBranch = await prisma.branch.create({ data: { companyId: setupCompany.id, name: 'Setup branch', code: 'SETUP' } });
          await prisma.userCompanyAccess.create({ data: { userId: owner.id, companyId: setupCompany.id } });
          await prisma.userBranchAccess.create({ data: { userId: owner.id, branchId: setupBranch.id } });
          await page.evaluate(selection => sessionStorage.setItem('branchsuite_admin_workspace_selection', JSON.stringify(selection)), { companyId: setupCompany.id, branchId: setupBranch.id });
          await page.setViewportSize({ width: 390, height: 844 });
          await page.goto(`${origin}/admin/attendance?view=leave&apply=1&branchId=${setupBranch.id}`, { waitUntil: 'networkidle' });
          await page.getByText('Set up leave before applying', { exact: true }).first().waitFor({ state: 'visible' });
          assert.equal(await page.getByRole('button', { name: '+ Apply', exact: true }).isDisabled(), true);
          await page.getByRole('button', { name: 'Set up leave types', exact: true }).click();
          await page.getByLabel('Leave code', { exact: true }).fill('UI_POLICY');
          await page.getByLabel('Leave name', { exact: true }).fill('UI setup leave');
          await page.getByLabel('Annual allowance', { exact: true }).fill('0');
          await page.getByRole('switch', { name: 'Paid leave', exact: true }).click();
          const configured = page.waitForResponse(response => response.url().includes('/leave/types') && response.request().method() === 'POST');
          await page.getByRole('button', { name: 'Create leave type', exact: true }).click();
          assert.equal((await configured).status(), 201);
          const policy = await prisma.leaveType.findUniqueOrThrow({ where: { companyId_code: { companyId: setupCompany.id, code: 'UI_POLICY' } } });
          assert.equal(policy.isPaid, false);
          assert.equal(policy.annualAllowance, 0);
          await page.getByRole('button', { name: 'Continue to leave application', exact: true }).click();
          await page.getByRole('button', { name: 'Submit Request', exact: true }).waitFor({ state: 'visible' });
          assert.equal(new URL(page.url()).searchParams.get('branchId'), setupBranch.id);
          const setupDate = new Date(Date.now() + 24 * 86400000).toISOString().slice(0, 10);
          await page.getByLabel('Start date', { exact: true }).fill(setupDate);
          await page.getByLabel('End date', { exact: true }).fill(setupDate);
          await page.getByLabel('Reason for leave', { exact: true }).fill('New company policy application');
          const setupSaved = page.waitForResponse(response => response.url().includes('/leave/requests') && response.request().method() === 'POST');
          await page.getByRole('button', { name: 'Submit Request', exact: true }).click();
          assert.equal((await setupSaved).status(), 201);
          await page.getByText('Leave request submitted successfully.', { exact: false }).first().waitFor({ state: 'visible' });
          const setupLeave = await prisma.leaveRequest.findFirstOrThrow({ where: { tenantId, companyId: setupCompany.id, reason: 'New company policy application' } });
          assert.equal(setupLeave.leaveTypeId, policy.id);
          assert.equal(setupLeave.branchId, setupBranch.id);
          process.stdout.write('Empty company: configure leave type, return to application and submit checked\n');
          await context.close();
          continue;
        }
        for (const width of process.env.BROWSER_NAVIGATION_ONLY === '1' ? [] : floatingInputs ? [390, 768, 1440] : webLayoutOnly ? (role === 'owner' || role === 'employee' ? [768, 1024, 1440] : [768, 1440]) : process.env.BROWSER_AUDIT_FOCUS === '1' ? [390, 1440] : role === 'owner' || role === 'employee' ? [320, 390, 768, 1024, 1440] : [390, 1440]) {
          await page.setViewportSize({ width, height: width < 500 ? 844 : 900 });
          for (const path of routes[role]) {
            await page.goto(`${origin}${path}`, { waitUntil: 'networkidle', timeout: 30000 });
            const result = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, text: document.body.innerText }));
            if (result.scroll > result.width + 2) errors.push(`${width}px ${path}: document overflows by ${result.scroll - result.width}px`);
            assert.ok(!/Unmatched Route|Uncaught Error|Something went wrong|This screen couldn.t load|Validation failed \(uuid|Cannot GET \/|Cannot read properties/.test(result.text), `${width}px ${path}: error screen`);
            if (process.env.BROWSER_UX_AUDIT === '1' && [390, 1440].includes(width)) {
              const key = path.replace(/[^a-zA-Z0-9]/g, '-');
              await page.screenshot({ path: require('node:path').join(output, 'ux-' + role + '-' + width + key + '.png'), fullPage: true });
              const searches = page.getByRole('textbox', { name: /^Search / });
              for (let i = 0; i < await searches.count(); i++) {
                const input = searches.nth(i);
                if (!await input.isVisible() || !await input.isEditable()) continue;
                const label = await input.getAttribute('aria-label');
                if (!label || label === 'Search a module') continue;
                await input.fill('zz-no-match-ux-audit');
                assert.ok(!(await input.getAttribute('placeholder')), 'Search fields should not show extra placeholder hints');
                assert.equal(await input.evaluate(element => Array.from(element.parentElement.children).some(child => child.textContent === 'Search')), true, 'Search fields should share the floating Search label');
                const clear = page.getByRole('button', { name: 'Clear ' + label.toLowerCase(), exact: true });
                if (await clear.count()) { await clear.click(); assert.equal(await input.inputValue(), ''); }
              }
            }
            if (path === '/admin/crm' && [320, 390, 1440].includes(width) || path === '/employee/dashboard' && width === 390) await page.screenshot({ path: require('node:path').join(output, `${role}-${width}.png`), fullPage: true });
          }
          process.stdout.write(`Browser audit: ${role}, ${width}px checked\n`);
        }
        if (role === 'owner' && process.env.BROWSER_UX_FOCUS === '1') {
          await page.setViewportSize({ width: 390, height: 844 });
          await page.goto(origin + '/admin/crm/deals-live?create=1', { waitUntil: 'networkidle' });
          await page.getByRole('button', { name: 'Opportunity branch', exact: true }).click();
          await page.getByRole('button', { name: branch.name, exact: true }).click();
          await page.getByLabel('Deal title (required)', { exact: true }).fill('UX review opportunity');
          await page.getByLabel('Amount (INR)', { exact: true }).fill('1250');
          await page.getByRole('button', { name: 'Linked lead (optional)', exact: true }).click();
          await page.getByRole('button', { name: lead.name, exact: true }).click();
          await page.getByRole('button', { name: 'Linked lead (optional)', exact: true }).click();
          await page.getByRole('button', { name: 'No linked lead', exact: true }).click();
          await page.getByRole('button', { name: 'Save deal', exact: true }).click();
          await page.getByText('UX review opportunity', { exact: true }).first().waitFor();
          const created = await prisma.deal.findFirstOrThrow({ where: { tenantId, title: 'UX review opportunity' } });
          assert.equal(created.branchId, branch.id);
          const search = page.getByLabel('Search deals', { exact: true });
          await search.fill('no-matching-opportunity');
          await page.getByText('No matching deals. Add a deal or adjust your filters.', { exact: true }).first().waitFor();
          await page.getByRole('button', { name: 'Clear search deals', exact: true }).click();
          await page.getByText('UX review opportunity', { exact: true }).first().waitFor();
          await page.getByRole('button', { name: 'Filter by stage', exact: true }).click();
          await page.getByRole('button', { name: 'Lost', exact: true }).click();
          assert.equal(await page.getByText('UX review opportunity', { exact: true }).count(), 0);
          await page.getByRole('button', { name: 'Filter by stage', exact: true }).click();
          await page.getByRole('button', { name: 'All stages', exact: true }).click();
          await page.getByText('UX review opportunity', { exact: true }).first().waitFor();
          await page.goto(origin + '/admin/employees/create', { waitUntil: 'networkidle' });
          await page.getByRole('button', { name: 'Branch *', exact: true }).click();
          await page.getByRole('button', { name: secondBranch.name, exact: true }).click();
          assert.equal(await page.getByRole('button', { name: 'Branch *', exact: true }).getAttribute('aria-expanded'), 'false');
          await page.goto(origin + '/admin/billing', { waitUntil: 'networkidle' });
          await page.getByLabel('Search invoices', { exact: true }).fill('no-matching-invoice');
          await page.getByText('No invoices match your search or status filter.', { exact: true }).first().waitFor();
          await page.getByRole('button', { name: 'Clear search invoices', exact: true }).click();
          await page.getByRole('button', { name: 'Invoice status', exact: true }).click();
          await page.getByRole('button', { name: 'Paid', exact: true }).click();
          console.log('UX interactions: CRM dropdown save, stage filtering, search clear, employee branch selection and invoice filters checked');
        }
        if (role === 'owner' && !webLayoutOnly && !floatingInputs) {
          await page.setViewportSize({ width: 390, height: 844 });
          await page.goto(`${origin}/admin/crm/lead-form`, { waitUntil: 'networkidle' });
          await page.getByLabel('Organisation *', { exact: true }).fill('Browser created lead');
          await page.getByLabel('Contact person *', { exact: true }).fill('Browser contact');
          await page.getByLabel('Email *', { exact: true }).fill('browser@example.invalid');
          await page.getByLabel('Phone *', { exact: true }).fill('9876543210');
          await page.getByLabel(/Estimated value/).fill('5000');
          await page.getByRole('button', { name: 'Create lead', exact: true }).click();
          await page.waitForURL(/\/admin\/crm\/deals-live/, { timeout: 15000 });
          assert.ok((await prisma.lead.findMany({ where: { tenantId, name: 'Browser created lead' } })).length === 1);
          await page.getByText('Browser created lead', { exact: true }).first().first().waitFor({ state: 'visible', timeout: 15000 });
        }
        if (webLayoutOnly) {
          const workspace = role === 'employee' ? 'Employee' : 'Admin';
          const dashboardPath = role === 'employee' ? '/employee/dashboard' : '/admin/dashboard';
          const homeLabel = role === 'employee' ? 'My work' : 'Dashboard';
          const target = role === 'owner' ? ['Roles & access', '/admin/roles-permissions', 'permissions']
            : role === 'hr' ? ['Leave management', '/admin/leave-management', 'leave']
            : role === 'payroll' ? ['Salary advances', '/admin/advances', 'advances']
            : ['My documents', '/employee/documents', 'documents'];
          for (const width of [768, 900, 1024, 1199, 1200, 1440, 1920]) {
            await page.setViewportSize({ width, height: width < 1000 ? 1024 : 900 });
            await page.goto(`${origin}${dashboardPath}`, { waitUntil: 'networkidle' });
            if (width < 1200) {
              await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
              await page.getByRole('button', { name: 'Close navigation', exact: true }).waitFor();
              await page.keyboard.press('Escape');
              await page.getByRole('button', { name: 'Close navigation', exact: true }).waitFor({ state: 'hidden' });
              await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
            } else {
              assert.equal(await page.getByRole('button', { name: 'Open navigation', exact: true }).count(), 0);
            }
            const home = page.getByRole('link', { name: homeLabel, exact: true });
            assert.equal(await home.getAttribute('aria-current'), 'page');
            if (role === 'hr' || role === 'payroll') {
              assert.equal(await page.getByRole('link', { name: 'Roles & access', exact: true }).count(), 0);
              assert.equal(await page.getByRole('link', { name: 'CRM overview', exact: true }).count(), 0);
            }
            const navigationSearch = page.getByLabel(`Find a page in ${workspace.toLowerCase()} navigation`, { exact: true });
            await navigationSearch.fill(target[2]);
            await page.getByRole('link', { name: target[0], exact: true }).waitFor();
            if (width === 768) await page.screenshot({ path: path.join(output, `${role}-tablet-navigation.png`), fullPage: true, animations: 'disabled' });
            await page.getByRole('link', { name: target[0], exact: true }).click();
            await page.waitForURL(`**${target[1]}`);
            if (width < 1200) await page.getByRole('button', { name: 'Close navigation', exact: true }).waitFor({ state: 'hidden' });
            else {
              assert.equal(await page.getByRole('link', { name: target[0], exact: true }).getAttribute('aria-current'), 'page');
              await navigationSearch.fill('');
              await page.getByRole('link', { name: homeLabel, exact: true }).focus();
              await page.keyboard.press('Enter');
              await page.waitForURL(`**${dashboardPath}`);
              await page.waitForLoadState('networkidle');
              if (role !== 'employee') await page.getByText('Loading business data...', { exact: true }).first().waitFor({ state: 'hidden', timeout: 15000 });
              if (width === 1440 || width === 1920) await page.screenshot({ path: path.join(output, `${role}-desktop-${width}.png`), fullPage: true, animations: 'disabled' });
            }
            const dimensions = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
            assert.ok(dimensions.scroll <= dimensions.width + 2, `${role} navigation overflows at ${width}px`);
          }
          // Changing device orientation must dismiss the tablet overlay.
          await page.setViewportSize({ width: 1024, height: 768 });
          await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
          await page.setViewportSize({ width: 1440, height: 900 });
          await page.getByRole('button', { name: 'Close navigation', exact: true }).waitFor({ state: 'hidden' });
          await page.getByRole('link', { name: homeLabel, exact: true }).waitFor();
          process.stdout.write(`Web navigation: ${role}, search, permissions, keyboard, drawer and orientation checked at 768–1920px\n`);
        }
        if (floatingInputs) {
          const checkFloating = async (testPage, input, caption, value) => {
            const label = input.locator('..').getByText(caption, { exact: true });
            await input.focus();
            await testPage.waitForFunction(element => element.getBoundingClientRect().top < element.parentElement.getBoundingClientRect().top + 4, await label.elementHandle());
            const focus = await input.evaluate(element => ({ outline: getComputedStyle(element).outlineWidth, outlineStyle: getComputedStyle(element).outlineStyle, shadow: getComputedStyle(element).boxShadow, border: getComputedStyle(element.parentElement).borderLeftColor }));
            assert.equal(focus.outline, '0px'); assert.equal(focus.outlineStyle, 'none'); assert.equal(focus.shadow, 'none'); assert.equal(focus.border, 'rgb(26, 115, 232)');
            assert.equal(await label.evaluate(element => getComputedStyle(element).backgroundColor), 'rgba(0, 0, 0, 0)');
            await input.fill(value);
            await input.evaluate(element => element.blur());
            await testPage.waitForFunction(element => element.getBoundingClientRect().top < element.parentElement.getBoundingClientRect().top + 4, await label.elementHandle());
            assert.equal(await input.inputValue(), value);
          };
          if (role === 'owner') {
            const authContext = await browser.newContext();
            try {
              const authPage = await authContext.newPage();
              await authPage.setViewportSize({ width: 1440, height: 1000 });
              await authPage.goto(`${origin}/auth/login`, { waitUntil: 'networkidle' });
              const email = authPage.getByLabel('Work email', { exact: true });
              await checkFloating(authPage, email, 'Work email', 'review@example.invalid');
              await email.fill(''); await email.evaluate(element => element.blur());
              await authPage.waitForFunction(element => element.getBoundingClientRect().top > element.parentElement.getBoundingClientRect().top + 10, await email.locator('..').getByText('Work email', { exact: true }).elementHandle());
              await checkFloating(authPage, email, 'Work email', 'review@example.invalid');
              const passwordInput = authPage.getByLabel('Password', { exact: true });
              await checkFloating(authPage, passwordInput, 'Password', 'Review-password-123');
              await authPage.getByRole('button', { name: 'Show password', exact: true }).click();
              assert.equal(await passwordInput.evaluate(element => element.type), 'text');
              assert.equal(await passwordInput.inputValue(), 'Review-password-123');
              await email.focus();
              await authPage.screenshot({ path: path.join(output, 'floating-login-desktop.png'), fullPage: true, animations: 'disabled' });
              await authPage.setViewportSize({ width: 390, height: 844 });
              await authPage.screenshot({ path: path.join(output, 'floating-login-mobile.png'), fullPage: true, animations: 'disabled' });
              await authPage.goto(`${origin}/auth/reset-password`, { waitUntil: 'networkidle' });
              await checkFloating(authPage, authPage.getByLabel('New password', { exact: true }), 'New password', 'Review-password-123');
            } finally { await authContext.close(); }
            await page.setViewportSize({ width: 1440, height: 1000 });
            await page.goto(`${origin}/admin/crm/lead-form`, { waitUntil: 'networkidle' });
            await checkFloating(page, page.getByLabel('Organisation *', { exact: true }), 'Organisation *', 'Floating label review');
            await page.screenshot({ path: path.join(output, 'floating-admin-form.png'), fullPage: true, animations: 'disabled' });
          } else {
            await page.setViewportSize({ width: 768, height: 1024 });
            await page.goto(`${origin}/employee/advances`, { waitUntil: 'networkidle' });
            await checkFloating(page, page.getByLabel('Amount (INR)', { exact: true }), 'Amount (INR)', '2500.50');
            await checkFloating(page, page.getByLabel('Reason', { exact: true }), 'Reason', 'Multiline input review');
            await page.getByLabel('Reason', { exact: true }).focus();
            await page.screenshot({ path: path.join(output, 'floating-employee-form.png'), fullPage: true, animations: 'disabled' });
          }
          process.stdout.write(`Floating inputs: ${role}, outlined labels, focus, filled values and input semantics checked\n`);
        }
        if (role === 'employee' && (employeeOnly || floatingInputs)) {
          await page.setViewportSize({ width: 390, height: 844 });
          await page.goto(`${origin}/employee/profile`, { waitUntil: 'networkidle' });
          await page.getByText('Backend manager', { exact: true }).first().waitFor();

          // Future start dates must be selectable without editing the end first.
          await page.goto(`${origin}/employee/leave`, { waitUntil: 'networkidle' });
          await page.getByRole('button', { name: 'Apply for leave', exact: true }).click();
          await page.getByRole('button', { name: /^Leave start date:.*Open calendar$/ }).click();
          const future = new Date(Date.now() + 35 * 86400000);
          const futureLabel = future.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
          for (let i = 0; i < 3 && !(await page.getByRole('button', { name: futureLabel, exact: true }).count()); i++)
            await page.getByRole('button', { name: 'Next month', exact: true }).click();
          await page.screenshot({ path: path.join(output, 'employee-leave-calendar.png'), fullPage: true, animations: 'disabled' });
          await page.getByRole('button', { name: futureLabel, exact: true }).click();
          await page.getByText('1 calendar day', { exact: false }).first().waitFor();
          await page.getByRole('button', { name: 'Reporting to', exact: true }).click();
          await page.getByRole('button', { name: /BRANCH_MANAGER.*Branch Manager/ }).click();
          await page.getByRole('button', { name: 'Submit Request', exact: true }).click();
          await page.getByText('Enter a leave reason of up to 2000 characters.', { exact: true }).first().waitFor();
          await page.getByLabel('Reason', { exact: true }).fill('Browser employee leave request');
          await page.getByRole('button', { name: 'Submit Request', exact: true }).click();
          await page.getByText('Leave request submitted successfully.', { exact: true }).first().waitFor();
          const savedLeave = await prisma.leaveRequest.findFirstOrThrow({ where: { tenantId, reason: 'Browser employee leave request' } });
          assert.equal(savedLeave.status, 'PENDING');
          await page.getByRole('button', { name: 'Cancel Test leave request', exact: true }).first().click();
          await page.getByRole('button', { name: 'Confirm cancellation', exact: true }).click();
          await page.getByText('Leave request cancelled.', { exact: true }).first().waitFor();
          assert.equal((await prisma.leaveRequest.findUniqueOrThrow({ where: { id: savedLeave.id } })).status, 'CANCELLED');

          await page.goto(`${origin}/employee/advances`, { waitUntil: 'networkidle' });
          await page.getByRole('button', { name: 'Request advance', exact: true }).click();
          await page.getByText('Enter a positive amount with up to two decimal places.', { exact: true }).first().waitFor();
          await page.getByRole('button', { name: 'Set advance amount to 2500 rupees', exact: true }).click();
          assert.equal(await page.getByLabel('Amount (INR)', { exact: true }).inputValue(), '2500');
          await page.getByLabel('Reason', { exact: true }).fill('Browser employee salary advance');
          await page.getByRole('button', { name: 'Request advance', exact: true }).click();
          await page.getByText('Salary advance request submitted successfully.', { exact: true }).first().waitFor();
          await page.getByText('Browser employee salary advance', { exact: true }).first().waitFor();
          await page.getByRole('button', { name: 'Cancel pending advance request', exact: true }).click();
          await page.getByRole('button', { name: 'Confirm cancellation', exact: true }).click();
          await page.getByText('Advance request cancelled.', { exact: true }).first().waitFor();
          assert.equal((await prisma.salaryAdvance.findFirstOrThrow({ where: { tenantId, reason: 'Browser employee salary advance' } })).status, 'CANCELLED');

          await page.goto(`${origin}/employee/help`, { waitUntil: 'networkidle' });
          await page.getByRole('button', { name: 'Payroll', exact: true }).click();
          assert.equal(await page.getByLabel('Support request subject', { exact: true }).inputValue(), 'Payslip or payment question');
          await page.getByRole('button', { name: 'Submit support request', exact: true }).click();
          await page.getByText('Enter a subject of at least 4 characters and at least 10 characters describing the issue.', { exact: true }).first().waitFor();
          await page.getByLabel('Describe support request', { exact: true }).fill('Browser employee support message');
          await page.getByRole('button', { name: 'Submit support request', exact: true }).click();
          await page.getByText('Your support request was submitted.', { exact: true }).first().waitFor();
          await page.getByRole('button', { name: 'Reply to Payslip or payment question', exact: true }).click();
          await page.getByLabel('Reply to support', { exact: true }).fill('Browser employee support follow-up');
          await page.getByRole('button', { name: 'Send reply', exact: true }).click();
          await page.getByText('Your reply was sent.', { exact: true }).first().waitFor();
          await page.getByText('Browser employee support follow-up', { exact: true }).first().waitFor();
          assert.ok(await prisma.supportTicketMessage.findFirst({ where: { message: 'Browser employee support follow-up', ticket: { tenantId } } }));

          await page.goto(`${origin}/employee/documents`, { waitUntil: 'networkidle' });
          await page.getByRole('button', { name: 'Preview Employment confirmation', exact: true }).click();
          await page.getByText('Issued by your HR team and loaded from your company account.', { exact: true }).first().waitFor();
          await page.evaluate(() => { window.showSaveFilePicker = undefined; });
          const download = page.waitForEvent('download');
          await page.getByRole('button', { name: 'Download PDF', exact: true }).click();
          assert.match((await download).suggestedFilename(), /\.pdf$/);
          await page.getByRole('button', { name: 'Close dialog', exact: true }).click();

          if (employeeTasks.length) {
            await page.goto(`${origin}/employee/tasks/${employeeTasks[0].id}`, { waitUntil: 'networkidle' });
            await page.getByLabel('Progress comment', { exact: true }).fill('Browser employee progress update');
            await page.getByRole('button', { name: 'Save Progress', exact: true }).click();
            await page.getByText('Progress comment added.', { exact: true }).first().waitFor();
            assert.ok(await prisma.taskComment.findFirst({ where: { taskId: employeeTasks[0].id, message: 'Browser employee progress update' } }));
          }
          await page.screenshot({ path: path.join(output, 'employee-module-check.png'), fullPage: true });

          // A failed document request must have an actionable retry.
          await page.route('**/employee-documents/my', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Temporary document outage' }) }));
          await page.goto(`${origin}/employee/documents`, { waitUntil: 'networkidle' });
          await page.getByText('The server could not complete your request. Please try again.', { exact: true }).first().waitFor();
          await page.unroute('**/employee-documents/my');
          await page.getByRole('button', { name: 'Retry loading documents', exact: true }).click();
          await page.getByRole('button', { name: 'Preview Employment confirmation', exact: true }).waitFor();

          // Multiple active assignments require an explicit selection.
          await request('PUT', `/users/${employee.id}/access`, { companyId: otherCompany.id, branchIds: [otherBranch.id] });
          await prisma.employeeProfile.create({ data: { tenantId, companyId: otherCompany.id, branchId: otherBranch.id, userId: employee.id, employeeCode: 'TEST02', joiningDate: new Date('2026-01-01') } });
          await page.goto(`${origin}/employee/profile`, { waitUntil: 'networkidle' });
          await page.getByText('Choose your work assignment', { exact: true }).first().waitFor();
          await page.getByRole('button', { name: 'Work assignment: Other test company, Test Other', exact: true }).click();
          await page.getByText('TEST02', { exact: true }).first().waitFor();
          await page.getByRole('button', { name: 'Work assignment: Test company, Test North', exact: true }).click();
          await page.getByText('TEST01', { exact: true }).first().waitFor();
          await page.getByText('Backend manager', { exact: true }).first().waitFor();
          await page.getByText('Sign out', { exact: true }).click();
          await page.waitForURL(/\/auth\/login/);
          assert.equal(await page.evaluate(() => sessionStorage.getItem('branchsuite_access_token')), null);
          await request('GET', '/employees/me', undefined, 'employee', 401);
          process.stdout.write('Employee forms: calendar, validation, cancellations, support replies, document PDF/retry, task progress, work assignments and logout checked\n');
        }
        await context.close();
      }
      assert.deepEqual([...new Set(errors)], []);
    } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
  });
});
