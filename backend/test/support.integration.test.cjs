'use strict';

const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');

const testUrl = process.env.SUPPORT_TEST_DATABASE_URL;
const localNetwork = process.env.SUPPORT_LOCAL_NETWORK === '1';
const localBackendOrigin = 'http://127.0.0.1:4241';
let configuredUrl;
try { configuredUrl = dotenv.parse(fs.readFileSync(path.join(__dirname, '../.env'))).DATABASE_URL; } catch { /* no .env */ }
// Alternative to the (expired) Neon branch: an attested, isolated, loopback database launched through scripts/safe-env.
const localGuard = require('../scripts/safe-env/db-target-guard.cjs');
let localMode = null;
try { const c = localGuard.assertSafeDatabaseTarget(process.env); if (c.enforced) localMode = c; } catch { /* not a guarded local run */ }
let blocked = '';
if (localMode) { /* attested isolated local database: allowed; identity is verified live below */ }
else if (!testUrl) blocked = 'BLOCKED: SUPPORT_TEST_DATABASE_URL (isolated disposable database) is not configured';
else if (process.env.SUPPORT_TEST_DATABASE_CONFIRM !== 'disposable') blocked = 'BLOCKED: set SUPPORT_TEST_DATABASE_CONFIRM=disposable to confirm the database may be written';
else if (new URL(testUrl).hostname.split('.')[0].replace(/-pooler$/, '') !== 'ep-orange-bird-b3hsltfm') blocked = 'BLOCKED: expected the independently verified support-integration-test endpoint';
else if (testUrl === configuredUrl || testUrl === process.env.DATABASE_URL) blocked = 'BLOCKED: refusing to run against the configured shared DATABASE_URL';
if (!blocked && !localMode) { process.env.DATABASE_URL = testUrl; process.env.DIRECT_URL = testUrl; }

require('reflect-metadata');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');

test('support dashboard end-to-end workflow', { skip: blocked || false, timeout: 900000 }, async t => {
  const bcrypt = require('bcrypt');
  const { NestFactory } = require('@nestjs/core');
  const { FastifyAdapter } = require('@nestjs/platform-fastify');
  const { ValidationPipe } = require('@nestjs/common');
  const { AppModule } = require('../dist/app.module');
  const { PrismaService } = require('../dist/prisma/prisma.service');

  const app = await NestFactory.create(AppModule, new FastifyAdapter(), { logger: false });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  if (localNetwork) app.enableCors({ origin: ['http://127.0.0.1:8181', 'http://127.0.0.1:8182'], credentials: true, methods: ['GET','HEAD','POST','PATCH','PUT','DELETE','OPTIONS'], allowedHeaders: ['Content-Type','Authorization','Accept','X-Tenant-Id','X-Company-Id','X-Branch-Id'] });
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  const prisma = app.get(PrismaService);
  if (localMode) await localGuard.assertSafeTargetWithClient(prisma);
  else {
    const identity = await prisma.$queryRawUnsafe("SELECT current_setting('neon.endpoint_id',true) AS endpoint");
    assert.equal(identity[0].endpoint, 'ep-orange-bird-b3hsltfm', 'Refuse writes on any endpoint except the verified isolated test branch');
  }
  if (localNetwork) {
    const migrations = await prisma.$queryRawUnsafe(`SELECT count(*)::int AS applied FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`);
    assert.equal(migrations[0].applied, 44);
    await app.listen(4241, '127.0.0.1');
    console.log('LOCAL_BACKEND_READY http://127.0.0.1:4241/api/v1 endpoint=ep-orange-bird-b3hsltfm migrations=44');
  }
  const password = `Test-${randomUUID()}`;
  const run = randomUUID().slice(0, 8);
  // Own the injected test peer instead of exhausting a developer browser's IP budget.
  const fixturePeer = `127.78.${parseInt(run.slice(0, 2), 16)}.${1 + parseInt(run.slice(2, 4), 16) % 254}`;
  const tenantA = randomUUID(); const tenantB = randomUUID();
  const platformIds = [];
  const tokens = {};
  const SECRET = `PRIVATE-NOTE-${run}`;

  const call = async (method, url, body, who, expected) => {
    const headers = { ...(tokens[who] ? { authorization: `Bearer ${tokens[who]}` } : {}), ...(body === undefined ? {} : { 'content-type': 'application/json' }) };
    const response = localNetwork ? await fetch(localBackendOrigin + '/api/v1' + url, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }) : null;
    const res = response ? { statusCode: response.status, body: await response.text() } : await app.inject({ method, url: `/api/v1${url}`, remoteAddress: fixturePeer, headers, ...(body === undefined ? {} : { payload: body }) });
    if (expected !== undefined) assert.ok([].concat(expected).includes(res.statusCode), `${who} ${method} ${url}: expected ${expected}, got ${res.statusCode}: ${res.body.slice(0, 300)}`);
    return { status: res.statusCode, text: res.body, json: () => JSON.parse(res.body) };
  };
  const ok = async (method, url, body, who, expected = method === 'POST' ? 201 : 200) => (await call(method, url, body, who, expected)).json();

  t.after(async () => {
    try {
      for (const id of [tenantA, tenantB]) {
        await prisma.supportTicket.deleteMany({ where: { tenantId: id } });
        await prisma.auditEvent.deleteMany({ where: { tenantId: id } });
        await prisma.notification.deleteMany({ where: { tenantId: id } });
      }
      await prisma.auditEvent.deleteMany({ where: { actorId: { in: platformIds } } });
      await prisma.platformUser.deleteMany({ where: { id: { in: platformIds } } });
      await prisma.tenant.deleteMany({ where: { id: { in: [tenantA, tenantB] } } });
    } finally { await app.close(); }
  });

  // ---- fixtures: two tenants, companies, branches, users, two platform staff ----
  await prisma.tenant.create({ data: { id: tenantA, name: `Tenant A ${run}` } });
  await prisma.tenant.create({ data: { id: tenantB, name: `Tenant B ${run}` } });
  await prisma.businessSubscription.createMany({ data: [{ tenantId: tenantA, planId: 'starter', billingCycle: 'monthly' }, { tenantId: tenantB, planId: 'starter', billingCycle: 'monthly' }] });
  const companyA = await prisma.company.create({ data: { tenantId: tenantA, name: `Company A ${run}` } });
  const companyB = await prisma.company.create({ data: { tenantId: tenantB, name: `Company B ${run}` } });
  const branchA = await prisma.branch.create({ data: { companyId: companyA.id, name: 'North', code: `N${run}`.toUpperCase().slice(0, 12) } });
  const branchB = await prisma.branch.create({ data: { companyId: companyB.id, name: 'Main', code: `M${run}`.toUpperCase().slice(0, 12) } });
  const makeUser = async (tenantId, company, branch, role, name) => {
    const configured = await prisma.role.findUniqueOrThrow({ where: { name: role } });
    return prisma.user.create({ data: {
      tenantId, name, email: `${role.toLowerCase()}-${randomUUID()}@example.invalid`, password: await bcrypt.hash(password, 4),
      roles: { create: { roleId: configured.id, companyId: ['BUSINESS_OWNER', 'BUSINESS_ADMIN'].includes(role) ? null : company.id } },
      companyAccess: { create: { companyId: company.id } }, branchAccess: { create: { branchId: branch.id } },
    } });
  };
  const requester = await makeUser(tenantA, companyA, branchA, 'EMPLOYEE', 'Riya Requester');
  const colleague = await makeUser(tenantA, companyA, branchA, 'EMPLOYEE', 'Colin Colleague');
  const companyAdmin = await makeUser(tenantA, companyA, branchA, 'BUSINESS_ADMIN', 'Cora CompanyAdmin');
  const ownerA = await makeUser(tenantA, companyA, branchA, 'BUSINESS_OWNER', 'Olga OwnerA');
  const ownerB = await makeUser(tenantB, companyB, branchB, 'BUSINESS_OWNER', 'Omar OwnerB');
  const managerA = await makeUser(tenantA, companyA, branchA, 'HR_MANAGER', 'Harper Manager');
  const employeeB = await makeUser(tenantB, companyB, branchB, 'EMPLOYEE', 'Elena EmployeeB');
  const platformUser = async (role, name) => {
    const user = await prisma.platformUser.create({ data: { name, email: `${role.toLowerCase()}-${randomUUID()}@example.invalid`, passwordHash: await bcrypt.hash(password, 4), role } });
    platformIds.push(user.id); return user;
  };
  const support = await platformUser('PLATFORM_SUPPORT', 'Sam Support');
  const admin = await platformUser('PLATFORM_ADMIN', 'Ada Admin');
  for (const [key, user, portal] of [['manager', managerA, 'staff'], ['requester', requester, 'employee'], ['colleague', colleague, 'employee'], ['companyAdmin', companyAdmin, 'staff'], ['ownerA', ownerA, 'staff'], ['ownerB', ownerB, 'staff'], ['employeeB', employeeB, 'employee']])
    tokens[key] = (await ok('POST', '/auth/login', { email: user.email, password, portal }, undefined, 201)).accessToken;
  for (const [key, user] of [['support', support], ['admin', admin]])
    tokens[key] = (await ok('POST', '/platform/auth/login', { email: user.email, password }, undefined, 201)).accessToken;

  let ticketId;
  await t.test('Business employee creates a ticket with validated, ticket-bound identities', async () => {
    const ticket = await ok('POST', '/support/tickets', { companyId: companyA.id, branchId: branchA.id, category: 'PAYROLL', subject: `Payslip ${run}`, message: 'My payslip is missing the allowance.' }, 'requester');
    ticketId = ticket.id;
    assert.equal(ticket.status, 'OPEN'); assert.equal(ticket.priority, 'NORMAL');
    assert.equal(ticket.requester.name, 'Riya Requester'); assert.equal(ticket.company.name, `Company A ${run}`); assert.equal(ticket.branch.name, 'North');
    assert.deepEqual([ticket.messages[0].authorRole, ticket.messages[0].authorName], ['REQUESTER', 'Riya Requester']);
    // Branch of another company / another tenant's company is rejected.
    await call('POST', '/support/tickets', { companyId: companyA.id, branchId: branchB.id, category: 'OTHER', subject: 'Cross branch', message: 'Cross branch attempt text' }, 'requester', 404);
    await call('POST', '/support/tickets', { companyId: companyB.id, category: 'OTHER', subject: 'Cross tenant', message: 'Cross tenant attempt text' }, 'requester', 404);
  });

  await t.test('Support and Admin dashboards receive the ticket with business context and canonical counts', async () => {
    for (const who of ['support', 'admin']) {
      const list = await ok('GET', `/platform/support/tickets?search=${encodeURIComponent(`Payslip ${run}`)}`, undefined, who);
      const row = list.items.find(item => item.id === ticketId);
      assert.ok(row, `${who} sees the ticket`);
      assert.deepEqual([row.customerName, row.company.name, row.branch.name, row.requester.name, row.awaitingSupport], [`Tenant A ${run}`, `Company A ${run}`, 'North', 'Riya Requester', true]);
      assert.ok((await ok('GET', '/platform/support/summary', undefined, who)).open >= 1);
    }
    // Search by business, company and requester names.
    for (const term of [`Tenant A ${run}`, `Company A ${run}`, 'Riya Requester'])
      assert.ok((await ok('GET', `/platform/support/tickets?search=${encodeURIComponent(term)}`, undefined, 'support')).items.some(item => item.id === ticketId), term);
    assert.ok((await ok('GET', '/platform/dashboard/summary', undefined, 'admin')).support.openTickets >= 1);
  });

  let notificationsBefore;
  await t.test('Support replies; Business receives the reply and a notification (once)', async () => {
    notificationsBefore = (await ok('GET', '/notifications', undefined, 'requester')).length;
    await ok('POST', `/platform/support/tickets/${ticketId}/replies`, { message: 'We are checking your payslip.' }, 'support');
    const mine = (await ok('GET', '/support/tickets/my', undefined, 'requester')).find(item => item.id === ticketId);
    const reply = mine.messages.find(item => item.message === 'We are checking your payslip.');
    assert.deepEqual([reply.authorName, reply.authorRole, reply.authorId], ['BranchSuite Support', 'PLATFORM_SUPPORT', null]);
    assert.ok(!JSON.stringify(mine).includes('Sam Support') && !JSON.stringify(mine).includes(support.id), 'platform staff identity is not disclosed');
    const notices = await ok('GET', '/notifications', undefined, 'requester');
    assert.equal(notices.length, notificationsBefore + 1);
    assert.equal(notices[0].href, '/employee/help?ticketId=' + ticketId);
    assert.ok(!notices[0].message.includes('checking your payslip'));
    // Company admin sees it too, labelled correctly when the admin replies.
    await ok('POST', `/support/tickets/${ticketId}/messages`, { message: 'Admin here, following up.' }, 'companyAdmin');
    const list = (await ok('GET', `/support/tickets?companyId=${companyA.id}`, undefined, 'companyAdmin')).find(item => item.id === ticketId);
    const adminMsg = list.messages.find(item => item.message === 'Admin here, following up.');
    assert.deepEqual([adminMsg.authorRole, adminMsg.authorName], ['COMPANY_ADMIN', 'Cora CompanyAdmin']);
    notificationsBefore = (await ok('GET', '/notifications', undefined, 'requester')).length;
  });

  await t.test('Support adds a private note: Admin sees it; Business never does (API, notifications, audit)', async () => {
    await ok('POST', `/platform/support/tickets/${ticketId}/replies`, { message: SECRET, visibility: 'INTERNAL' }, 'support');
    const adminView = await ok('GET', `/platform/support/tickets/${ticketId}`, undefined, 'admin');
    const note = adminView.messages.find(item => item.message === SECRET);
    assert.deepEqual([note.visibility, note.authorName, note.authorRole], ['INTERNAL', 'Sam Support', 'PLATFORM_SUPPORT']);
    assert.ok(adminView.history.some(item => item.action === 'TICKET_NOTE_ADDED' && item.visibility === 'INTERNAL'));
    const probes = [
      ['requester', '/support/tickets/my'], ['companyAdmin', `/support/tickets?companyId=${companyA.id}`], ['ownerA', `/support/tickets?companyId=${companyA.id}`],
      ['requester', '/notifications'], ['companyAdmin', '/notifications'], ['ownerA', `/audit?companyId=${companyA.id}&limit=100`], ['ownerA', `/audit?companyId=${companyA.id}&module=PLATFORM_INTERNAL`],
    ];
    for (const [who, url] of probes) assert.ok(!(await call('GET', url, undefined, who)).text.includes(SECRET), `${who} ${url} must not contain the note`);
    for (const [who, url] of probes.slice(0, 3)) assert.ok(!(await call('GET', url, undefined, who)).text.includes('TICKET_NOTE_ADDED'), `${who} ${url} must not reveal a note event`);
    assert.equal((await ok('GET', '/notifications', undefined, 'requester')).length, notificationsBefore, 'a note creates no notification');
    // Business cannot write an internal message, even by smuggling the field.
    // The Business DTO has no visibility field: the pipe strips it, so the message is stored as an ordinary CUSTOMER message.
    await call('POST', `/support/tickets/${ticketId}/messages`, { message: 'smuggle', visibility: 'INTERNAL' }, 'requester', 201);
    const smuggled = await prisma.supportTicketMessage.findFirstOrThrow({ where: { ticketId, message: 'smuggle' } });
    assert.deepEqual([smuggled.visibility, smuggled.authorRole, smuggled.platformAuthorId], ['CUSTOMER', 'REQUESTER', null]);
    assert.equal(await prisma.supportTicketMessage.count({ where: { ticketId, visibility: 'INTERNAL', businessAuthorId: { not: null } } }), 0);
  });

  await t.test('Support changes priority and status; Admin and Business see the authorized updates', async () => {
    await ok('PATCH', `/platform/support/tickets/${ticketId}/priority`, { priority: 'HIGH', expectedPriority: 'NORMAL' }, 'support', 200);
    await ok('PATCH', `/platform/support/tickets/${ticketId}/status`, { status: 'IN_PROGRESS', expectedStatus: 'OPEN' }, 'support', 200);
    const adminView = await ok('GET', `/platform/support/tickets/${ticketId}`, undefined, 'admin');
    assert.deepEqual([adminView.status, adminView.priority], ['IN_PROGRESS', 'HIGH']);
    assert.deepEqual(adminView.history.filter(item => /CHANGED/.test(item.action)).map(item => item.summary), ['Priority changed from NORMAL to HIGH', 'Status changed from OPEN to IN_PROGRESS']);
    const mine = (await ok('GET', '/support/tickets/my', undefined, 'requester')).find(item => item.id === ticketId);
    assert.deepEqual([mine.status, mine.priority], ['IN_PROGRESS', 'HIGH']);
    assert.ok(mine.history.some(item => item.summary === 'Status changed from OPEN to IN_PROGRESS' && item.actorName === 'BranchSuite Support'));
    assert.equal((await ok('GET', '/notifications', undefined, 'requester')).length, notificationsBefore + 1, 'status change notifies once');
    assert.equal((await ok('GET', '/platform/dashboard/summary', undefined, 'admin')).support.openTickets >= 1, true);
  });

  await t.test('lifecycle: invalid transitions, closing, closed replies, reopening, customer reply reopens RESOLVED', async () => {
    await ok('PATCH', `/platform/support/tickets/${ticketId}/status`, { status: 'RESOLVED' }, 'support', 200);
    await ok('POST', `/support/tickets/${ticketId}/messages`, { message: 'Still broken after the fix.' }, 'requester');
    assert.equal((await ok('GET', `/platform/support/tickets/${ticketId}`, undefined, 'admin')).status, 'OPEN', 'customer reply reopens RESOLVED');
    await ok('PATCH', `/platform/support/tickets/${ticketId}/status`, { status: 'CLOSED' }, 'support', 200);
    await call('PATCH', `/platform/support/tickets/${ticketId}/status`, { status: 'RESOLVED' }, 'support', 400);
    await call('PATCH', `/platform/support/tickets/${ticketId}/status`, { status: 'DONE' }, 'support', 400);
    await call('POST', `/platform/support/tickets/${ticketId}/replies`, { message: 'late reply' }, 'support', 409);
    await call('POST', `/support/tickets/${ticketId}/messages`, { message: 'late customer reply' }, 'requester', 400);
    await ok('POST', `/platform/support/tickets/${ticketId}/replies`, { message: 'post-mortem note', visibility: 'INTERNAL' }, 'admin');
    await ok('PATCH', `/support/tickets/${ticketId}`, { status: 'OPEN' }, 'companyAdmin', 200);
    await call('PATCH', `/support/tickets/${ticketId}`, { status: 'CLOSED' }, 'requester', 403);
    assert.equal((await ok('GET', `/platform/support/tickets/${ticketId}`, undefined, 'support')).status, 'OPEN');
  });

  await t.test('concurrent changes produce exactly one winner and a 409 for the loser', async () => {
    const results = await Promise.all([
      call('PATCH', `/platform/support/tickets/${ticketId}/status`, { status: 'IN_PROGRESS', expectedStatus: 'OPEN' }, 'support'),
      call('PATCH', `/platform/support/tickets/${ticketId}/status`, { status: 'RESOLVED', expectedStatus: 'OPEN' }, 'admin'),
    ]);
    assert.deepEqual(results.map(item => item.status).sort(), [200, 409]);
    const final = (await ok('GET', `/platform/support/tickets/${ticketId}`, undefined, 'admin')).status;
    assert.ok(['IN_PROGRESS', 'RESOLVED'].includes(final));
    await call('PATCH', `/platform/support/tickets/${ticketId}/priority`, { priority: 'LOW', expectedPriority: 'NORMAL' }, 'support', 409);
  });

  await t.test('tenant isolation, requester isolation and guessed identifiers', async () => {
    // Another tenant's company is reported as not found (403 or 404 are both non-disclosing denials; never 200).
    await call('GET', `/support/tickets?companyId=${companyA.id}`, undefined, 'ownerB', [403, 404]);
    assert.ok(!(await ok('GET', '/support/tickets/my', undefined, 'employeeB')).some(item => item.id === ticketId));
    assert.ok(!(await ok('GET', `/support/tickets?companyId=${companyB.id}`, undefined, 'ownerB')).some(item => item.id === ticketId));
    for (const who of ['ownerB', 'employeeB']) {
      await call('POST', `/support/tickets/${ticketId}/messages`, { message: 'guessed id reply' }, who, 404);
      await call('PATCH', `/support/tickets/${ticketId}`, { status: 'CLOSED' }, who, [403, 404]);
    }
    await call('POST', `/support/tickets/${ticketId}/messages`, { message: 'not my ticket' }, 'colleague', 403);
    await call('GET', `/support/tickets?companyId=${companyA.id}`, undefined, 'colleague', 403);
    assert.ok(!(await ok('GET', '/support/tickets/my', undefined, 'colleague')).some(item => item.id === ticketId));
    // Business tokens never reach platform routes and vice versa.
    for (const who of ['requester', 'companyAdmin', 'ownerA']) await call('GET', '/platform/support/tickets', undefined, who, 401);
    await call('GET', '/support/tickets/my', undefined, 'support', 401);
    await call('GET', '/platform/support/tickets', undefined, undefined, 401);
  });

  await t.test('Support stays blocked from Admin-only modules', async () => {
    for (const url of ['/platform/customers', '/platform/audit/events', '/platform/marketing/offers', '/platform/settings/general'])
      assert.equal((await call('GET', url, undefined, 'support')).status, 403, `support must not read ${url}`);
    for (const url of ['/platform/customers', '/platform/audit/events']) assert.equal((await call('GET', url, undefined, 'admin')).status, 200, `admin reads ${url}`);
  });

  await t.test('database constraints reject inconsistent rows', async () => {
    await assert.rejects(prisma.supportTicket.create({ data: { tenantId: tenantA, companyId: companyB.id, createdById: requester.id, subject: 'Mismatch', category: 'OTHER' } }), /does not belong|violat|check/i);
    await assert.rejects(prisma.supportTicket.create({ data: { tenantId: tenantA, companyId: companyA.id, branchId: branchB.id, createdById: requester.id, subject: 'Branch mismatch', category: 'OTHER' } }));
    await assert.rejects(prisma.supportTicket.create({ data: { tenantId: tenantA, companyId: companyA.id, createdById: employeeB.id, subject: 'Creator mismatch', category: 'OTHER' } }));
    await assert.rejects(prisma.$executeRaw`UPDATE "SupportTicket" SET "status" = 'BOGUS' WHERE "id" = ${ticketId}`);
    await assert.rejects(prisma.$executeRaw`UPDATE "SupportTicket" SET "priority" = 'BOGUS' WHERE "id" = ${ticketId}`);
    await assert.rejects(prisma.supportTicketMessage.create({ data: { ticketId, authorId: requester.id, businessAuthorId: requester.id, authorRole: 'REQUESTER', visibility: 'INTERNAL', message: 'x' } }), /check/i);
    await assert.rejects(prisma.supportTicketMessage.create({ data: { ticketId, authorId: requester.id, businessAuthorId: requester.id, platformAuthorId: support.id, authorRole: 'REQUESTER', message: 'x' } }), /check/i);
  });

  await t.test('data persists across reload (fresh reads from all authorized clients)', async () => {
    const [mine, adminView, supportView] = await Promise.all([
      ok('GET', '/support/tickets/my', undefined, 'requester'), ok('GET', `/platform/support/tickets/${ticketId}`, undefined, 'admin'), ok('GET', `/platform/support/tickets/${ticketId}`, undefined, 'support'),
    ]);
    const ticket = mine.find(item => item.id === ticketId);
    assert.equal(adminView.status, supportView.status);
    assert.equal(ticket.status, adminView.status);
    assert.equal(ticket.messages.length, adminView.messages.filter(item => item.visibility === 'CUSTOMER').length);
    assert.ok(adminView.messages.some(item => item.visibility === 'INTERNAL'));
    assert.ok(!JSON.stringify(mine).includes(SECRET));
  });
  await t.test('Phase 1: owner/admin creation, optional branch, exact notification filtering and platform facets', async () => {
    const companyWide = await ok('POST', '/support/tickets', { companyId: companyA.id, category: 'ACCOUNT', subject: 'Owner issue ' + run, message: 'Please help with this account issue.' }, 'ownerA');
    const adminTicket = await ok('POST', '/support/tickets', { companyId: companyA.id, branchId: branchA.id, category: 'OTHER', subject: 'Admin issue ' + run, message: 'Please help with this branch issue.' }, 'companyAdmin');
    assert.equal(companyWide.branchId, null);
    const exact = await ok('GET', '/support/tickets/my?ticketId=' + companyWide.id, undefined, 'ownerA');
    assert.deepEqual(exact.map(t => t.id), [companyWide.id]);
    assert.deepEqual(await ok('GET', '/support/tickets/my?ticketId=' + companyWide.id, undefined, 'employeeB'), []);
    const branch = await ok('GET', '/support/tickets?companyId=' + companyA.id + '&branchId=' + branchA.id, undefined, 'companyAdmin');
    assert.ok(branch.some(t => t.id === adminTicket.id)); assert.ok(!branch.some(t => t.id === companyWide.id));
    const list = await ok('GET', '/platform/support/tickets?companyId=' + companyA.id + '&branchId=' + branchA.id + '&priority=NORMAL&limit=1', undefined, 'support');
    assert.equal(list.items.length, 1); assert.equal(list.items[0].branchId, branchA.id); assert.equal(list.items[0].priority, 'NORMAL');
    assert.ok(list.filters.companies.some(c => c.id === companyA.id));
    assert.ok(list.filters.branches.some(b => b.id === branchA.id && b.companyId === companyA.id));
    assert.deepEqual(Object.keys(list.filters.companies.find(c => c.id === companyA.id)).sort(), ['id', 'name']);
    const managerTicket = await ok('POST', '/support/tickets', { companyId: companyA.id, branchId: branchA.id, category: 'OTHER', subject: 'Manager request', message: 'Help me with my own request.' }, 'manager');
    assert.deepEqual((await ok('GET', '/support/tickets/my?ticketId=' + managerTicket.id, undefined, 'manager')).map(t => t.id), [managerTicket.id]);
    assert.deepEqual(await ok('GET', '/support/tickets/my?ticketId=' + adminTicket.id, undefined, 'manager'), []);
    await call('GET', '/support/tickets?companyId=' + companyA.id, undefined, 'manager', 403);
    await ok('POST', '/support/tickets/' + managerTicket.id + '/messages', { message: 'Additional details from the requester.' }, 'manager');
    await call('GET', '/support/tickets/my?ticketId=invalid', undefined, 'ownerA', 400);
  });

  await t.test('Phase 2 assignment concurrency, eligibility, escalation and Business privacy', async phase2 => {
    const second = await platformUser('PLATFORM_SUPPORT', 'Second Support');
    tokens.support2 = (await ok('POST', '/platform/auth/login', { email: second.email, password }, undefined)).accessToken;
    const fresh = await ok('POST', '/support/tickets', { companyId: companyA.id, category: 'OTHER', subject: 'Phase2 '+run, message: 'A new support request for phase two.' }, 'requester');
    const id = fresh.id, endpoint = '/platform/support/tickets/'+id;
    const detail = who => ok('GET', endpoint, undefined, who || 'support');
    let row = await detail();
    assert.equal(row.supportRevision, 0); assert.equal(row.customerActivityVersion, 1); assert.equal(row.unread, true);
    assert.equal(row.slaState, 'ON_TRACK'); assert.ok(row.responseDueAt && row.resolutionDueAt);
    const snapshot = [row.responseDueAt, row.resolutionDueAt];
    const claims = await Promise.all(['support','support2'].map(who => call('POST', endpoint+'/claim', { expectedRevision: 0 }, who)));
    assert.deepEqual(claims.map(x => x.status).sort(), [201,409]);
    row = await detail(); assert.equal(row.supportRevision, 1); assert.ok([support.id,second.id].includes(row.assignedToId));
    await call('PATCH', endpoint+'/assignment', { expectedRevision: 1, agentId: support.id }, 'support', 403);
    await call('PATCH', endpoint+'/assignment', { expectedRevision: 1, agentId: admin.id }, 'admin', 400);
    await ok('PATCH', endpoint+'/assignment', { expectedRevision: 1, agentId: null }, 'admin');
    await call('PATCH', endpoint+'/assignment', { expectedRevision: 1, agentId: second.id }, 'admin', 409);
    await prisma.platformUser.update({where:{id:second.id},data:{status:'SUSPENDED'}});
    await call('PATCH', endpoint+'/assignment', { expectedRevision: 2, agentId: second.id }, 'admin', 400);
    await assert.rejects(prisma.supportTicket.update({where:{id},data:{assignedToId:second.id}}));
    await ok('PATCH', endpoint+'/assignment', { expectedRevision: 2, agentId: support.id }, 'admin');
    await ok('POST', endpoint+'/escalation', { expectedRevision: 3, reason: SECRET+'-escalation' }, 'support');
    await call('POST', endpoint+'/escalation', { expectedRevision: 4, reason: 'Duplicate request' }, 'support', 409);
    await call('PATCH', endpoint+'/escalation', { expectedRevision: 4, status: 'ACKNOWLEDGED' }, 'support', 403);
    await ok('PATCH', endpoint+'/escalation', { expectedRevision: 4, status: 'ACKNOWLEDGED' }, 'admin');
    await ok('PATCH', endpoint+'/escalation', { expectedRevision: 5, status: 'RESOLVED' }, 'admin');
    const business = (await ok('GET','/support/tickets/my?ticketId='+id,undefined,'requester'))[0];
    assert.equal(business.assignedToSupport,true); assert.equal(business.escalationStage,'RESOLVED');
    for (const key of ['assignedToId','slaPolicyVersion','supportRevision','customerActivityVersion','escalationReason','escalatedById','readStates','responseDueAt']) assert.ok(!(key in business),key);
    assert.ok(!JSON.stringify(business).includes(SECRET)); assert.ok(!JSON.stringify(business).includes(support.id));
    for(const url of ['/notifications','/audit?companyId='+companyA.id+'&limit=100']) assert.ok(!(await call('GET',url,undefined,'ownerA')).text.includes(SECRET+'-escalation'));
    const history = (await detail('admin')).history;
    assert.ok(history.some(x => x.action === 'TICKET_ASSIGNMENT_CHANGED'));
    assert.ok(history.some(x => x.action === 'TICKET_ESCALATION_REQUESTED'));
    await prisma.platformUser.update({where:{id:second.id},data:{status:'ACTIVE'}});

    await phase2.test('per-agent observed-version read state is monotonic and GET never marks read', async () => {
      assert.equal((await detail()).unread, true); assert.equal((await detail()).unread,true);
      await ok('POST',endpoint+'/read',{customerActivityVersion:1},'support');
      assert.equal((await detail()).unread,false); assert.equal((await detail('support2')).unread,true);
      await ok('POST',endpoint+'/replies',{message:'Private diagnostic note',visibility:'INTERNAL'},'support');
      assert.equal((await detail()).firstResponseAt,null); assert.equal((await detail()).customerActivityVersion,1);
      await ok('POST',endpoint+'/replies',{message:'First public support response'},'support');
      const responseAt = (await detail()).firstResponseAt; assert.ok(responseAt);
      await ok('POST','/support/tickets/'+id+'/messages',{message:'Customer follow-up details'},'requester');
      assert.equal((await detail()).customerActivityVersion,2); assert.equal((await detail()).unread,true);
      await ok('POST',endpoint+'/read',{customerActivityVersion:1},'support'); assert.equal((await detail()).unread,true);
      await call('POST',endpoint+'/read',{customerActivityVersion:999},'support',400);
      await Promise.all([1,2,1].map(customerActivityVersion => ok('POST',endpoint+'/read',{customerActivityVersion},'support')));
      assert.equal((await detail()).unread,false); assert.equal((await detail('support2')).unread,true);
      await ok('POST',endpoint+'/replies',{message:'Second public response'},'support');
      assert.equal((await detail()).firstResponseAt,responseAt);
    });
    await phase2.test('SLA initial-cycle outcomes survive priority changes and reopen; filters agree with counts', async () => {
      await ok('PATCH',endpoint+'/priority',{priority:'URGENT',expectedPriority:'NORMAL'},'support');
      await ok('PATCH',endpoint+'/status',{status:'RESOLVED'},'support');
      const resolved = (await detail()).resolvedAt; assert.ok(resolved);
      await ok('PATCH',endpoint+'/status',{status:'OPEN'},'support');
      row = await detail(); assert.equal(row.resolvedAt,resolved); assert.deepEqual([row.responseDueAt,row.resolutionDueAt],snapshot);
      const queue = await ok('GET','/platform/support/tickets?companyId='+companyA.id+'&assignedToId='+support.id+'&view=MINE&priority=URGENT&search='+encodeURIComponent('Phase2 '+run)+'&limit=1',undefined,'support');
      assert.equal(queue.total,1); assert.equal(queue.totalPages,1); assert.equal(queue.items[0].id,id);
      assert.equal((await ok('GET','/platform/support/tickets?view=UNASSIGNED&search='+encodeURIComponent('Phase2 '+run),undefined,'support')).total,0);
      assert.equal((await ok('GET','/platform/support/tickets?unread=true&search='+encodeURIComponent('Phase2 '+run),undefined,'support2')).total,1);
      await call('GET','/platform/support/tickets?createdFrom=2026-11-06&createdTo=2026-11-05',undefined,'support',400);
      await prisma.supportTicket.update({where:{id},data:{responseDueAt:new Date('2020-01-01'),resolutionDueAt:new Date('2020-01-02')}});
      assert.equal((await detail()).slaState,'OVERDUE');
      const overdue=await ok('GET','/platform/support/tickets?slaState=OVERDUE&search='+encodeURIComponent('Phase2 '+run),undefined,'support');
      assert.equal(overdue.total,1); assert.equal(overdue.items[0].slaState,'OVERDUE');
      const legacy=await prisma.supportTicket.create({data:{tenantId:tenantA,companyId:companyA.id,createdById:requester.id,subject:'Legacy Phase2 '+run,category:'OTHER'}});
      assert.equal((await ok('GET','/platform/support/tickets/'+legacy.id,undefined,'support')).slaState,'NOT_TRACKED');
      assert.equal((await ok('GET','/platform/support/tickets?slaState=NOT_TRACKED&search='+encodeURIComponent('Legacy Phase2 '+run),undefined,'support')).total,1);
      await prisma.supportTicket.update({where:{id:legacy.id},data:{responseDueAt:new Date(Date.now()+30*60000),resolutionDueAt:new Date(Date.now()+120*60000)}});
      assert.equal((await ok('GET','/platform/support/tickets?slaState=DUE_SOON&search='+encodeURIComponent('Legacy Phase2 '+run),undefined,'support')).total,1);
      await prisma.supportTicket.update({where:{id:legacy.id},data:{firstResponseAt:new Date(),resolvedAt:new Date()}});
      assert.equal((await ok('GET','/platform/support/tickets?slaState=MET&search='+encodeURIComponent('Legacy Phase2 '+run),undefined,'support')).total,1);
      for(const update of [{supportRevision:-1},{customerActivityVersion:0},{escalationStatus:'INVALID'},{responseTargetMinutes:10,resolutionTargetMinutes:1}]) await assert.rejects(prisma.supportTicket.update({where:{id:legacy.id},data:update}));

    });
    await phase2.test('real analytics and minimal directory remain Support-authorized and private',async()=>{
      const summary=await ok('GET','/platform/support/summary',undefined,'support');
      assert.equal(summary.trend.length,14); assert.ok(summary.overdue>=1); assert.ok(summary.assigned>=1);
      assert.equal(typeof summary.averageFirstResponseMs,'number'); assert.equal(typeof summary.averageResolutionMs,'number');
      assert.ok(summary.workload.some(x=>x.id===support.id&&x.assigned>=1));
      await ok('POST','/support/tickets',{companyId:companyB.id,category:'OTHER',subject:'Directory B '+run,message:'A second business support request.'},'ownerB');
      const dir=await ok('GET','/platform/support/businesses?search='+run+'&limit=1&sort=NAME',undefined,'support');
      const page2=await ok('GET','/platform/support/businesses?search='+run+'&limit=1&sort=NAME&page=2',undefined,'support');
      assert.equal(dir.total,2);assert.equal(dir.totalPages,2);assert.equal(dir.items.length,1);assert.equal(page2.items.length,1);assert.notEqual(dir.items[0].id,page2.items[0].id);
      const context=await ok('GET','/platform/support/businesses/'+companyA.id,undefined,'support');
      assert.ok(context.branches.some(x=>x.name==='North')); assert.ok(context.requesters.some(x=>x.name==='Riya Requester'));
      for(const secret of ['password','bankAccount','salary','billing','email']) assert.ok(!JSON.stringify(context).includes(secret));
      await call('GET','/platform/support/businesses',undefined,'requester',401);
      await call('GET','/platform/customers',undefined,'support',403);
      const unrelated=await prisma.company.create({data:{tenantId:tenantA,name:'No Support tickets '+run}});
      await call('GET','/platform/support/businesses/'+unrelated.id,undefined,'support',404);
      assert.ok(!(await ok('GET','/platform/support/businesses?search='+run,undefined,'support')).items.some(x=>x.id===unrelated.id));
    });
  });

  await t.test('live browser Business to Support to Business workflow on isolated backend', {skip:process.env.SUPPORT_LIVE_BROWSER!=='1',timeout:300000}, async browserTest => {
    const http=require('node:http');
    const {chromium,expect}=require('../../frontend/node_modules/@playwright/test');
    const browser=await chromium.launch({channel:'msedge',headless:true}); browserTest.after(()=>browser.close());
    const errors=[];
    async function portal(folder,session) {
      if (localNetwork) {
        const origin = folder === 'frontend' ? 'http://127.0.0.1:8181' : 'http://127.0.0.1:8182';
        const context = await browser.newContext({ viewport: { width: folder === 'frontend' ? 390 : 1366, height: 950 } });
        await context.addInitScript(({folder,session}) => {
          sessionStorage.setItem(folder === 'frontend' ? 'branchsuite_access_token' : 'branchsuite.superadmin.session', folder === 'frontend' ? session.token : JSON.stringify(session));
        }, {folder,session});
        await context.route('**/*', route => {
          const request = route.request(), url = new URL(request.url());
          if (![origin,localBackendOrigin].includes(url.origin)) return route.abort();
          if (url.origin === localBackendOrigin && !['GET','HEAD','OPTIONS'].includes(request.method()) && !/^\/api\/v1\/(platform\/)?support\//.test(url.pathname)) return route.abort();
          return route.continue(); // Actual HTTP/CORS to the listening Nest server; no API fulfillment or proxy.
        });
        const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
        page.setDefaultTimeout(30000);
        return {page,origin};
      }
      const root=path.resolve(__dirname,'../../'+folder+'/dist/phase1');
      assert.ok(fs.existsSync(path.join(root,'index.html')),'Export both apps before live browser testing');
      const server=http.createServer((req,res)=>{
        const target=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
        if(target!==root&&!target.startsWith(root+path.sep))return res.writeHead(403).end();
        const file=fs.existsSync(target)&&fs.statSync(target).isFile()?target:path.join(root,'index.html');
        res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.ttf':'font/ttf','.png':'image/png'})[path.extname(file)]||'application/octet-stream');
        fs.createReadStream(file).pipe(res);
      });
      await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));browserTest.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));
      const origin='http://127.0.0.1:'+server.address().port;
      const context=await browser.newContext({viewport:{width:folder==='frontend'?390:1366,height:950}});
      await context.addInitScript(({folder,session})=>{
        sessionStorage.setItem(folder==='frontend'?'branchsuite_access_token':'branchsuite.superadmin.session',folder==='frontend'?session.token:JSON.stringify(session));
      },{folder,session});
      await context.route('**/*',async route=>{
        const request=route.request(),url=new URL(request.url());
        if(!url.pathname.startsWith('/api/v1/')) return url.origin===origin?route.continue():route.abort();
        // Real Nest/Fastify injection with real bearer tokens and isolated PostgreSQL; no API fixtures.
        // Only Support mutations are permitted from these browser sessions.
        if(!['GET','HEAD','OPTIONS'].includes(request.method())&&!/^\/api\/v1\/(platform\/)?support\//.test(url.pathname))return route.abort();
        const headers=request.headers();delete headers.host;delete headers['content-length'];
        const result=await app.inject({method:request.method(),url:url.pathname+url.search,headers,...(request.postData()?{payload:request.postData()}: {})});
        await route.fulfill({status:result.statusCode,contentType:result.headers['content-type']||'application/json',body:result.body});
      });
      const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));return {page,origin};
    }
    const business=await portal('frontend',{token:tokens.ownerA});
    await business.page.goto(business.origin+'/admin/platform-support');
    await business.page.getByRole('button',{name:'Raise issue',exact:true}).click();
    const subject='Live Phase2 '+run,reply='Live isolated browser reply '+run;
    await business.page.getByRole('textbox',{name:'Support request subject',exact:true}).fill(subject);
    await business.page.getByRole('textbox',{name:'Describe support request',exact:true}).fill('Please investigate this isolated browser support request.');
    await business.page.getByRole('button',{name:'Create ticket',exact:true}).click();
    await expect(business.page.getByText(subject,{exact:true})).toBeVisible();
    const saved=await prisma.supportTicket.findFirstOrThrow({where:{tenantId:tenantA,subject}});
    const platform=await portal('superadmin',{token:tokens.support,user:{id:support.id,name:support.name,email:support.email,role:'PLATFORM_SUPPORT'}});
    if (localNetwork) {
      await platform.page.goto(platform.origin+'/support');
      await platform.page.getByRole('textbox',{name:'Search subject, business or requester',exact:true}).fill(subject);
      await expect(platform.page.getByText(subject,{exact:true})).toBeVisible({timeout:60000});
      await expect(platform.page.getByText('Unread customer activity',{exact:false})).toBeVisible();
    }
    await platform.page.goto(platform.origin+'/support/'+saved.id);
    await expect(platform.page.getByText('Initial-cycle SLA: on track',{exact:true})).toBeVisible({timeout:60000});
    await platform.page.getByRole('button',{name:'Claim unassigned ticket',exact:true}).click();
    await expect(platform.page.getByText('Assigned agent: Sam Support',{exact:true})).toBeVisible();
    if (localNetwork) {
      // Ownership and reply activity intentionally do not imply a lifecycle transition.
      await platform.page.getByRole('button',{name:'Ticket status: Open',exact:true}).click();
      await platform.page.getByRole('menuitem',{name:'In progress',exact:true}).click();
      await platform.page.getByRole('button',{name:'Save status',exact:true}).click();
      await expect(platform.page.getByText('Status changed from OPEN to IN_PROGRESS',{exact:true})).toBeVisible();
    }
    const privateNote = 'Live private note '+run, escalationReason = 'Live internal escalation '+run;
    if (localNetwork) {
      await platform.page.getByRole('button',{name:'Message visibility: Customer reply',exact:true}).click();
      await platform.page.getByRole('menuitem',{name:'Internal note',exact:true}).click();
      await platform.page.getByRole('textbox',{name:'Reply / internal note',exact:true}).fill(privateNote);
      await platform.page.getByRole('button',{name:'Save note',exact:true}).click();
      await expect(platform.page.getByText(privateNote,{exact:true})).toBeVisible();
      await platform.page.getByRole('button',{name:'Message visibility: Internal note',exact:true}).click();
      await platform.page.getByRole('menuitem',{name:'Customer reply',exact:true}).click();
    }
    await platform.page.getByRole('textbox',{name:'Reply / internal note',exact:true}).fill(reply);
    await platform.page.getByRole('button',{name:'Send reply',exact:true}).click();
    await expect(platform.page.getByText(reply,{exact:true})).toBeVisible();
    await business.page.reload();
    await expect(business.page.getByText(reply,{exact:true})).toBeVisible();
    await expect(business.page.getByText('Assigned to Support',{exact:true})).toBeVisible();
    if (localNetwork) {
      await platform.page.getByRole('textbox',{name:'Staff-only escalation reason',exact:true}).fill(escalationReason);
      await platform.page.getByRole('button',{name:'Request escalation',exact:true}).click();
      await expect(platform.page.getByText('Escalation: requested',{exact:true})).toBeVisible();
      const adminPortal = await portal('superadmin',{token:tokens.admin,user:{id:admin.id,name:admin.name,email:admin.email,role:'PLATFORM_ADMIN'}});
      await adminPortal.page.goto(adminPortal.origin+'/support/'+saved.id);
      await adminPortal.page.getByRole('button',{name:'Acknowledge escalation',exact:true}).click();
      await expect(adminPortal.page.getByText('Escalation: acknowledged',{exact:true})).toBeVisible();
      await adminPortal.page.getByRole('button',{name:'Ticket status: In progress',exact:true}).click();
      await adminPortal.page.getByRole('menuitem',{name:'Resolved',exact:true}).click();
      await adminPortal.page.getByRole('button',{name:'Save status',exact:true}).click();
      await expect(adminPortal.page.getByText('Status changed from IN_PROGRESS to RESOLVED',{exact:true})).toBeVisible();
      await business.page.reload();
      await expect(business.page.getByRole('button',{name:'Open ticket '+subject,exact:true}).getByText('RESOLVED',{exact:true})).toBeVisible();
      await expect(business.page.getByText('Escalation: In review',{exact:true})).toBeVisible();
      await expect(business.page.getByText('Status changed from IN_PROGRESS to RESOLVED',{exact:true})).toBeVisible();
      await expect(business.page.getByText(privateNote,{exact:false})).toHaveCount(0);
      await expect(business.page.getByText(escalationReason,{exact:false})).toHaveCount(0);
      const publicView = (await ok('GET','/support/tickets/my?ticketId='+saved.id,undefined,'ownerA'))[0];
      for (const secret of [privateNote,escalationReason,support.id,'assignedToId','supportRevision','customerActivityVersion','responseDueAt']) assert.ok(!JSON.stringify(publicView).includes(secret), 'Business excludes '+secret);
      assert.equal(publicView.escalationStage,'ACKNOWLEDGED'); assert.equal(publicView.status,'RESOLVED');
      const notifications = await ok('GET','/notifications',undefined,'ownerA');
      assert.ok(notifications.some(n=>n.href?.endsWith(saved.id)));

      // A real Business follow-up advances freshness; only displaying detail acknowledges it.
      await platform.page.goto(platform.origin+'/support');
      await expect(platform.page.getByRole('textbox',{name:'Search subject, business or requester',exact:true})).toBeVisible();
      await business.page.getByRole('textbox',{name:'Reply to '+subject,exact:true}).fill('More details from the Business owner.');
      await business.page.getByRole('button',{name:'Send reply',exact:true}).click();
      await expect(business.page.getByText('More details from the Business owner.',{exact:true})).toBeVisible();
      await platform.page.goto(platform.origin+'/support');
      await platform.page.getByRole('textbox',{name:'Search subject, business or requester',exact:true}).fill(subject);
      await platform.page.getByRole('button',{name:'Ticket ownership: All tickets',exact:true}).click();
      await platform.page.getByRole('menuitem',{name:'My tickets',exact:true}).click();
      await platform.page.getByRole('button',{name:'Unread',exact:true}).click();
      await expect(platform.page.getByText(subject,{exact:true})).toBeVisible();
      await expect(platform.page.getByText('Unread customer activity',{exact:false})).toBeVisible();
      const unread = await ok('GET','/platform/support/tickets?view=MINE&unread=true&search='+encodeURIComponent(subject),undefined,'support');
      assert.equal(unread.total,1);assert.equal(unread.items[0].id,saved.id);

      await platform.page.goto(platform.origin+'/support-businesses');
      await platform.page.getByRole('textbox',{name:'Search business or company',exact:true}).fill('Company A '+run);
      await platform.page.getByRole('button',{name:'View support context for Company A '+run,exact:true}).click();
      await expect(platform.page.getByText('Ticket branches: North',{exact:true})).toBeVisible();
      await platform.page.getByRole('button',{name:'Open business tickets',exact:true}).click();
      await expect(platform.page.getByText(subject,{exact:true})).toBeVisible();
      await platform.page.goto(platform.origin+'/');
      await expect(platform.page.getByText('Support operations',{exact:true})).toBeVisible();
      await expect(platform.page.getByText('Workload by Support agent',{exact:true})).toBeVisible();
      console.log('LOCAL_ACCEPTANCE_WORKFLOW_PASS owner-create support-queue claim note public-reply escalation admin-ack resolution history privacy owner-followup unread filters directory analytics SLA');
    }
    const persisted=await prisma.supportTicket.findUniqueOrThrow({where:{id:saved.id},include:{messages:true,readStates:true}});
    assert.equal(persisted.assignedToId,support.id);assert.ok(persisted.firstResponseAt);assert.ok(persisted.messages.some(m=>m.message===reply));
    assert.ok(persisted.readStates.some(r=>r.platformUserId===support.id&&r.lastReadCustomerVersion>=1));
    assert.deepEqual(errors,[]);
  });

});
