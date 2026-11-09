require('reflect-metadata');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { validate } = require('class-validator');
const { plainToInstance } = require('class-transformer');

const policy = require('../src/modules/support/support-policy');
const { SupportPresenter, businessTicketInclude } = require('../src/modules/support/support-presenter.service');
const { PlatformSupportService } = require('../src/modules/platform/support/platform-support.service');
const { WorkspaceRecordsService } = require('../src/modules/workspace-records/workspace-records.service');
const { AuditService } = require('../src/modules/audit/audit.service');
const dto = require('../src/modules/platform/support/dto/support.dto');
const { UpdateSupportTicketDto } = require('../src/modules/workspace-records/dto/workspace-record.dto');

const TENANT = 'a0000000-0000-4000-8000-000000000001';
const COMPANY = 'b0000000-0000-4000-8000-000000000001';
const REQUESTER = 'c0000000-0000-4000-8000-000000000001';
const SUPPORT = { id: 'd0000000-0000-4000-8000-000000000001', name: 'Sam Support', email: 's@x.test', role: 'PLATFORM_SUPPORT', tokenVersion: 0 };
const ADMIN = { id: 'd0000000-0000-4000-8000-000000000002', name: 'Ada Admin', email: 'a@x.test', role: 'PLATFORM_ADMIN', tokenVersion: 0 };
const SECRET = 'PRIVATE-NOTE-DO-NOT-LEAK';

// Minimal in-memory Prisma double covering exactly what the support services use. It is a logic test double,
// not a substitute for the PostgreSQL integration suite (support.integration.test.cjs).
function fakePrisma(status = 'OPEN') {
  const db = {
    ticket: { id: 'e0000000-0000-4000-8000-000000000001', tenantId: TENANT, companyId: COMPANY, branchId: null, createdById: REQUESTER, subject: 'Payslip question', category: 'PAYROLL', priority: 'NORMAL', status, createdAt: new Date(), updatedAt: new Date() },
    messages: [], audits: [], notifications: [],
  };
  const api = {
    db,
    supportTicket: {
      findUnique: async () => ({ ...db.ticket, messages: db.messages, tenant: { id: TENANT, name: 'Tenant A' }, company: { id: COMPANY, name: 'Company A' }, branch: null, createdBy: { id: REQUESTER, name: 'Riya Requester' } }),
      findUniqueOrThrow: async () => ({ ...db.ticket }),
      updateMany: async ({ where, data }) => {
        if (where.status && where.status !== db.ticket.status) return { count: 0 };
        if (where.priority && where.priority !== db.ticket.priority) return { count: 0 };
        Object.assign(db.ticket, data); return { count: 1 };
      },
      findFirst: async () => ({ ...db.ticket }),
    },
    supportTicketMessage: { create: async ({ data }) => { const row = { id: `m${db.messages.length + 1}`, createdAt: new Date(), ...data }; db.messages.push(row); return row; } },
    auditEvent: { create: async ({ data }) => { db.audits.push({ id: `au${db.audits.length + 1}`, createdAt: new Date(), ...data }); }, findMany: async () => db.audits },
    notification: { create: async ({ data }) => { db.notifications.push(data); } },
    user: { findMany: async () => [{ id: REQUESTER, name: 'Riya Requester' }] },
    platformUser: { findMany: async () => [SUPPORT, ADMIN].map(({ id, name, role }) => ({ id, name, role })) },
    $transaction: async fn => Array.isArray(fn) ? Promise.all(fn) : fn(api),
  };
  return api;
}
const platformService = prisma => new PlatformSupportService(prisma, new SupportPresenter(prisma));

test('lifecycle: transition matrix allows reopen and forbids invalid jumps', () => {
  assert.equal(policy.canTransition('OPEN', 'IN_PROGRESS'), true);
  assert.equal(policy.canTransition('RESOLVED', 'OPEN'), true);
  assert.equal(policy.canTransition('CLOSED', 'OPEN'), true);
  for (const to of ['IN_PROGRESS', 'RESOLVED']) assert.equal(policy.canTransition('CLOSED', to), false, `CLOSED -> ${to}`);
  assert.equal(policy.canTransition('OPEN', 'BOGUS'), false);
  assert.throws(() => policy.assertTransition('CLOSED', 'RESOLVED'), /cannot move/);
  assert.deepEqual(policy.replyOutcome('CLOSED'), { allowed: false, reopens: false });
  assert.deepEqual(policy.replyOutcome('RESOLVED'), { allowed: true, reopens: true });
  assert.deepEqual([...policy.OPEN_STATUSES], ['OPEN', 'IN_PROGRESS']);
});

test('presenter: Business message view drops internal notes and hides platform identities', () => {
  const presenter = new SupportPresenter({});
  const base = { ticketId: 't', authorId: SUPPORT.id, createdAt: new Date() };
  assert.equal(presenter.businessMessage({ ...base, id: '1', visibility: 'INTERNAL', authorRole: 'PLATFORM_SUPPORT', message: SECRET }), null);
  const platformReply = presenter.businessMessage({ ...base, id: '2', visibility: 'CUSTOMER', authorRole: 'PLATFORM_ADMIN', message: 'hello', platformAuthor: { id: SUPPORT.id, name: 'Sam Support', role: 'PLATFORM_SUPPORT' } });
  assert.equal(platformReply.authorName, 'BranchSuite Support');
  assert.equal(platformReply.authorId, null);
  assert.ok(!JSON.stringify(platformReply).includes('Sam Support') && !JSON.stringify(platformReply).includes(SUPPORT.id));
  const admin = presenter.businessMessage({ ...base, id: '3', authorId: REQUESTER, visibility: 'CUSTOMER', authorRole: 'COMPANY_ADMIN', message: 'x', businessAuthor: { id: REQUESTER, name: 'Cora Admin' } });
  assert.deepEqual([admin.authorName, admin.authorRole], ['Cora Admin', 'COMPANY_ADMIN']);
  const ticket = presenter.businessTicket({ id: 't', messages: [{ ...base, id: '4', visibility: 'INTERNAL', authorRole: 'PLATFORM_SUPPORT', message: SECRET }, { ...base, id: '5', visibility: 'CUSTOMER', authorRole: 'PLATFORM_SUPPORT', message: 'public' }] }, []);
  assert.ok(!JSON.stringify(ticket).includes(SECRET));
  assert.equal(ticket.messages.length, 1);
});

test('query level: Business ticket include selects CUSTOMER messages only', () => {
  assert.deepEqual(businessTicketInclude.messages.where, { visibility: 'CUSTOMER' });
  const source = fs.readFileSync(path.join(__dirname, '../src/modules/workspace-records/workspace-records.service.ts'), 'utf8');
  assert.ok(!/platformTicketDetailInclude|platformTicketListInclude|visibility: 'INTERNAL'/.test(source), 'Business service must never use platform includes');
  assert.ok(!/messages: true|messages: \{ orderBy/.test(source.slice(source.indexOf('async createTicket'), source.indexOf('async invoices'))), 'Business ticket code must not load raw message relations');
});

test('internal note: persisted for platform, absent from notifications, Business history and timeline events', async () => {
  const prisma = fakePrisma('OPEN');
  const service = platformService(prisma);
  const result = await service.reply(prisma.db.ticket.id, { message: SECRET, visibility: 'INTERNAL' }, SUPPORT);
  assert.equal(result.message.visibility, 'INTERNAL');
  assert.equal(prisma.db.messages[0].visibility, 'INTERNAL');
  assert.equal(prisma.db.messages[0].platformAuthorId, SUPPORT.id);
  assert.equal(prisma.db.notifications.length, 0, 'internal notes never notify the Business requester');
  assert.equal(prisma.db.audits.length, 1);
  assert.equal(prisma.db.audits[0].module, policy.INTERNAL_AUDIT_MODULE);
  assert.ok(!JSON.stringify(prisma.db.audits).includes(SECRET), 'note content must not be written to the audit log');
  assert.equal(prisma.db.ticket.status, 'OPEN');
  const presenter = new SupportPresenter(prisma);
  const business = await presenter.history([prisma.db.ticket], false);
  assert.equal((business.get(prisma.db.ticket.id) ?? []).length, 0, 'Business timeline excludes note events');
  const platform = await presenter.history([prisma.db.ticket], true);
  assert.equal(platform.get(prisma.db.ticket.id)[0].action, 'TICKET_NOTE_ADDED');
  // Internal notes are allowed on CLOSED tickets and do not reopen them.
  const closed = fakePrisma('CLOSED');
  await platformService(closed).reply(closed.db.ticket.id, { message: 'post-mortem', visibility: 'INTERNAL' }, ADMIN);
  assert.equal(closed.db.ticket.status, 'CLOSED');
});

test('customer reply: notifies requester once, reopens RESOLVED, blocked on CLOSED', async () => {
  const prisma = fakePrisma('RESOLVED');
  const service = platformService(prisma);
  const result = await service.reply(prisma.db.ticket.id, { message: 'Fixed on our side.' }, SUPPORT);
  assert.equal(result.reopened, true);
  assert.equal(prisma.db.ticket.status, 'OPEN');
  assert.equal(prisma.db.notifications.length, 1);
  assert.deepEqual([prisma.db.notifications[0].userId, prisma.db.notifications[0].tenantId, prisma.db.notifications[0].href], [REQUESTER, TENANT, '/employee/help?ticketId=' + prisma.db.ticket.id]);
  assert.ok(!JSON.stringify(prisma.db.notifications).includes('Fixed on our side'), 'notification must not echo message content');
  assert.equal(prisma.db.messages[0].authorRole, 'PLATFORM_SUPPORT');
  const closed = fakePrisma('CLOSED');
  await assert.rejects(platformService(closed).reply(closed.db.ticket.id, { message: 'hi' }, SUPPORT), /Reopen the ticket/);
  assert.equal(closed.db.messages.length, 0);
});

test('lifecycle enforcement and concurrency on platform status/priority updates', async () => {
  const prisma = fakePrisma('CLOSED');
  const service = platformService(prisma);
  await assert.rejects(service.updateStatus(prisma.db.ticket.id, { status: 'RESOLVED' }, SUPPORT), /cannot move/);
  assert.equal(prisma.db.ticket.status, 'CLOSED');
  await service.updateStatus(prisma.db.ticket.id, { status: 'OPEN', expectedStatus: 'CLOSED' }, SUPPORT);
  assert.equal(prisma.db.ticket.status, 'OPEN');
  assert.equal(prisma.db.notifications.length, 1);
  await assert.rejects(service.updateStatus(prisma.db.ticket.id, { status: 'IN_PROGRESS', expectedStatus: 'CLOSED' }, SUPPORT), /modified/);
  await assert.rejects(service.updatePriority(prisma.db.ticket.id, { priority: 'URGENT', expectedPriority: 'LOW' }, SUPPORT), /modified/);
  await service.updatePriority(prisma.db.ticket.id, { priority: 'URGENT', expectedPriority: 'NORMAL' }, SUPPORT);
  assert.equal(prisma.db.ticket.priority, 'URGENT');
  assert.deepEqual(prisma.db.audits.map(item => item.action), ['TICKET_STATUS_CHANGED', 'TICKET_PRIORITY_CHANGED']);
});

test('compare-and-swap rejects a status change that raced the read', async () => {
  const prisma = fakePrisma('OPEN');
  const original = prisma.supportTicket.findUnique;
  prisma.supportTicket.findUnique = async () => { const snapshot = await original(); prisma.db.ticket.status = 'IN_PROGRESS'; return snapshot; };
  await assert.rejects(platformService(prisma).updateStatus(prisma.db.ticket.id, { status: 'RESOLVED' }, SUPPORT), /modified/);
  assert.equal(prisma.db.ticket.status, 'IN_PROGRESS');
  assert.equal(prisma.db.audits.length, 0);
});

test('role matrix: Support may manage tickets; no extra Admin-only support routes; module guarded', () => {
  const { PlatformSupportController } = require('../src/modules/platform/support/platform-support.controller');
  const proto = PlatformSupportController.prototype;
  const keys = Reflect.getMetadataKeys(PlatformSupportController);
  const classRoles = keys.map(key => Reflect.getMetadata(key, PlatformSupportController)).find(value => Array.isArray(value) && value.includes('PLATFORM_ADMIN'));
  assert.deepEqual([...classRoles].sort(), ['PLATFORM_ADMIN', 'PLATFORM_SUPPORT']);
  for (const method of ['status', 'priority']) {
    const own = Reflect.getMetadataKeys(proto[method]).map(key => Reflect.getMetadata(key, proto[method])).find(value => Array.isArray(value) && value.includes('PLATFORM_ADMIN'));
    assert.equal(own, undefined, `${method} must inherit both platform roles, not narrow to Admin`);
  }
  // Unrelated Admin-only modules keep their Admin-only guard.
  for (const [file, cls] of [['customers/platform-customers.controller', 'PlatformCustomersController'], ['audit/platform-audit.controller', 'PlatformAuditController']]) {
    let Controller; try { Controller = require(`../src/modules/platform/${file}`)[cls]; } catch { continue; }
    if (!Controller) continue;
    const roles = Reflect.getMetadataKeys(Controller).map(key => Reflect.getMetadata(key, Controller)).find(value => Array.isArray(value) && value.includes('PLATFORM_ADMIN'));
    assert.ok(roles && !roles.includes('PLATFORM_SUPPORT'), `${cls} must remain Admin-only`);
  }
});

test('DTO validation: visibility, status, priority and unknown values', async () => {
  const ok = plainToInstance(dto.CreatePlatformTicketReplyDto, { message: '  hi  ', visibility: 'INTERNAL' });
  assert.equal((await validate(ok)).length, 0);
  assert.equal(ok.message, 'hi');
  assert.ok((await validate(plainToInstance(dto.CreatePlatformTicketReplyDto, { message: 'x', visibility: 'PUBLIC' }))).length > 0);
  assert.ok((await validate(plainToInstance(dto.CreatePlatformTicketReplyDto, { message: 'x'.repeat(3001) }))).length > 0);
  assert.ok((await validate(plainToInstance(dto.UpdatePlatformTicketStatusDto, { status: 'DONE' }))).length > 0);
  assert.ok((await validate(plainToInstance(dto.UpdatePlatformTicketPriorityDto, { priority: 'CRITICAL' }))).length > 0);
  assert.ok((await validate(plainToInstance(UpdateSupportTicketDto, { status: 'ARCHIVED' }))).length > 0);
  assert.equal((await validate(plainToInstance(UpdateSupportTicketDto, { status: 'RESOLVED', expectedStatus: 'OPEN' }))).length, 0);
});

test('Business audit reader can never select internal-note events', async () => {
  let captured;
  const prisma = {
    userBranchAccess: { findMany: async () => [] }, userCompanyAccess: { findMany: async () => [] },
    auditEvent: { findMany: async args => { captured = args; return []; } },
    company: { findFirst: async () => ({ id: COMPANY }) }, branch: { findFirst: async () => null },
  };
  await new AuditService(prisma).list({ id: REQUESTER, tenantId: TENANT, roles: ['BUSINESS_OWNER'], companyId: COMPANY }, { companyId: COMPANY, module: policy.INTERNAL_AUDIT_MODULE });
  assert.ok(JSON.stringify(captured.where).includes(`"not":"${policy.INTERNAL_AUDIT_MODULE}"`));
});

test('Business service: company admin reply is labelled COMPANY_ADMIN and notifies the requester', async () => {
  const prisma = fakePrisma('OPEN');
  prisma.supportTicket.findFirst = async () => ({ ...prisma.db.ticket });
  prisma.supportTicket.findFirstOrThrow = async () => ({ ...prisma.db.ticket, messages: [], createdBy: { id: REQUESTER, name: 'Riya' }, company: { id: COMPANY, name: 'Co' }, branch: null });
  prisma.company = { findFirst: async () => ({ id: COMPANY }) };
  prisma.auditEvent.findMany = async () => [];
  const audit = { record: async (tx, event) => { prisma.db.audits.push(event); } };
  const service = new WorkspaceRecordsService(prisma, audit, new SupportPresenter(prisma));
  const admin = { id: 'f0000000-0000-4000-8000-000000000009', tenantId: TENANT, roles: ['BUSINESS_ADMIN'] };
  await service.addTicketMessage(admin, prisma.db.ticket.id, { message: 'We are on it.' });
  assert.equal(prisma.db.messages[0].authorRole, 'COMPANY_ADMIN');
  assert.equal(prisma.db.messages[0].businessAuthorId, admin.id);
  assert.equal(prisma.db.messages[0].platformAuthorId, undefined);
  assert.equal(prisma.db.notifications.length, 1);
  await assert.rejects(service.updateTicket(admin, prisma.db.ticket.id, { status: 'OPEN', expectedStatus: 'CLOSED' }), /modified/);
  const employee = { id: 'f0000000-0000-4000-8000-000000000010', tenantId: TENANT, roles: ['EMPLOYEE'] };
  await assert.rejects(service.addTicketMessage(employee, prisma.db.ticket.id, { message: 'not mine' }), /Ticket access denied/);
  await assert.rejects(service.updateTicket(employee, prisma.db.ticket.id, { status: 'CLOSED' }), /administrator access/);
});

test('migration and schema keep the support contract constraints', () => {
  const dir = path.join(__dirname, '../prisma/migrations');
  const name = fs.readdirSync(dir).find(entry => entry.endsWith('support_ticket_contract'));
  assert.ok(name, 'support_ticket_contract migration exists');
  const sql = fs.readFileSync(path.join(dir, name, 'migration.sql'), 'utf8');
  for (const needle of ['SupportTicket_tenantId_fkey', 'SupportTicket_companyId_fkey', 'SupportTicket_createdById_fkey', 'SupportTicket_status_check', 'SupportTicket_priority_check', 'SupportTicketMessage_visibility_check', 'SupportTicketMessage_internal_platform_check', 'SupportTicketMessage_single_author_check', 'support_ticket_scope_guard'])
    assert.ok(sql.includes(needle), needle);
  assert.ok(!/\b(DROP|TRUNCATE|DELETE FROM)\b/i.test(sql.replace(/--.*$/gm, '')), 'migration must be non-destructive');
  assert.ok(!/DROP COLUMN|DROP TABLE/i.test(sql));
});


test('Business filters stay constrained to requester/tenant and company-admin access', async () => {
  const prisma = fakePrisma(); const queries = [];
  prisma.supportTicket.findMany = async args => { queries.push(args.where); return []; };
  prisma.company = { findFirst: async () => ({ id: COMPANY }) };
  const service = new WorkspaceRecordsService(prisma, {}, new SupportPresenter(prisma));
  const manager = { id: REQUESTER, tenantId: TENANT, roles: ['HR_MANAGER'] };
  await service.myTickets(manager, { ticketId: 'ticket', branchId: 'branch' });
  assert.deepEqual(queries[0], { tenantId: TENANT, createdById: REQUESTER, id: 'ticket', branchId: 'branch' });
  await assert.rejects(service.tickets(manager, COMPANY), /administrator/);
  await service.tickets({ ...manager, roles: ['BUSINESS_ADMIN'] }, COMPANY, { branchId: 'branch' });
  assert.deepEqual(queries[1], { tenantId: TENANT, companyId: COMPANY, branchId: 'branch' });
});

test('platform ticket filters run before pagination and directory contains only ticket-bound context', async () => {
  const prisma = fakePrisma(); const requests = []; const dirs = [];
  prisma.$queryRaw = async sql => { requests.push(sql); return sql.sql.includes('COUNT(*)') ? [{ total: 1 }] : []; };
  prisma.supportTicket.count = async () => 1;
  prisma.supportTicket.findMany = async () => [];
  prisma.company = { findMany: async args => { dirs.push(args); return []; } };
  prisma.branch = { findMany: async args => { dirs.push(args); return []; } };
  const result = await platformService(prisma).list({ tenantId: TENANT, companyId: COMPANY, branchId: 'branch', priority: 'HIGH', page: 2, limit: 1 });
  for (const request of requests) for (const value of [TENANT, COMPANY, 'branch', 'HIGH']) assert.ok(request.values.includes(value));
  assert.match(requests[1].sql, /WHERE[\s\S]+ORDER BY[\s\S]+LIMIT \? OFFSET \?/);
  assert.deepEqual(requests[1].values.slice(-2), [1, 1]);
  assert.deepEqual(dirs.map(q => q.where), [{ supportTickets: { some: { tenantId: TENANT } } }, { supportTickets: { some: { tenantId: TENANT } } }]);
  assert.deepEqual(Object.keys(dirs[0].select).sort(), ['id', 'name']);
  assert.deepEqual(result.filters, { companies: [], branches: [] });
});
