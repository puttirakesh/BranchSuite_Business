require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validate } = require('class-validator');
const { plainToInstance } = require('class-transformer');
const { initialSla, slaState } = require('../src/modules/support/support-sla');
const { ticketWhere } = require('../src/modules/support/support-query');
const { SupportPresenter } = require('../src/modules/support/support-presenter.service');
const dto = require('../src/modules/platform/support/dto/support.dto');

test('SLA snapshots use UTC elapsed minutes and validate configurable development policy', () => {
  const now = new Date('2026-11-05T00:00:00Z');
  for (const [priority, response, resolution] of [['URGENT',30,240],['HIGH',120,1440],['NORMAL',480,4320],['LOW',1440,10080]]) {
    const snapshot = initialSla(priority, now, {});
    assert.equal(snapshot.responseDueAt - now, response * 60000);
    assert.equal(snapshot.resolutionDueAt - now, resolution * 60000);
  }
  assert.equal(initialSla('HIGH', now, { SUPPORT_SLA_HIGH_RESPONSE_MINUTES: '42' }).responseTargetMinutes, 42);
  for (const value of ['0','-1','1.5','NaN','525601']) assert.throws(() => initialSla('HIGH', now, { SUPPORT_SLA_HIGH_RESPONSE_MINUTES: value }));
  assert.throws(() => initialSla('LOW', now, { SUPPORT_SLA_LOW_RESOLUTION_MINUTES: '10' }));
});

test('SLA states preserve missed deadlines after completion and distinguish legacy records', () => {
  const now = new Date('2026-11-05T00:00:00Z');
  const t = initialSla('NORMAL', now, {});
  assert.equal(slaState({}, now), 'NOT_TRACKED');
  assert.equal(slaState(t, now), 'ON_TRACK');
  assert.equal(slaState(t, new Date(+now + 7 * 3600000)), 'DUE_SOON');
  assert.equal(slaState(t, new Date(+now + 9 * 3600000)), 'OVERDUE');
  assert.equal(slaState({ ...t, firstResponseAt: now, resolvedAt: now }, now), 'MET');
  assert.equal(slaState({ ...t, firstResponseAt: new Date(+t.responseDueAt + 1), resolvedAt: now }, now), 'OVERDUE');
});

test('queue filters bind hostile search, actor and dates before pagination', () => {
  const hostile = "%' OR TRUE; --";
  const query = ticketWhere({ search: hostile, view: 'MINE', unread: 'true', createdTo: '2026-11-05' }, 'agent');
  assert.ok(!query.sql.includes(hostile));
  assert.ok(query.values.includes('%' + hostile + '%'));
  assert.ok(query.values.includes('agent'));
  assert.ok(query.values.some(x => x instanceof Date && x.toISOString() === '2026-11-06T00:00:00.000Z'));
  assert.throws(() => ticketWhere({ createdFrom: '2026-11-06', createdTo: '2026-11-05' }, 'agent'), /reversed/);
  assert.doesNotThrow(() => ticketWhere({ createdFrom: '2026-11-05T12:00:00Z', createdTo: '2026-11-05' }, 'agent'));
});

test('Business whitelist excludes all Phase 2 private scalars and future fields', () => {
  const ticket = new SupportPresenter({}).businessTicket({ id: 'ticket', assignedToId: 'private-agent', supportRevision: 42,
    escalationStatus: 'REQUESTED', escalationReason: 'private-reason', escalatedById: 'private-actor', slaPolicyVersion: 'private-policy',
    customerActivityVersion: 20, responseDueAt: new Date(), futureSecret: 'private-future', messages: [] }, []);
  assert.equal(ticket.assignedToSupport, true);
  assert.equal(ticket.escalationStage, 'REQUESTED');
  assert.ok(!JSON.stringify(ticket).includes('private-'));
  for (const field of ['assignedToId','supportRevision','escalationReason','slaPolicyVersion','customerActivityVersion','responseDueAt','futureSecret']) assert.ok(!(field in ticket));
});

test('staff history preserves escalation reasons while Business history excludes the event', async () => {
  const presenter = new SupportPresenter({
    auditEvent: { findMany: async () => [{ id: 'event', tenantId: 'tenant', targetId: 'ticket', actorId: 'agent', module: 'PLATFORM_INTERNAL', action: 'TICKET_ESCALATION_REQUESTED', changes: { reason: 'Private specialist context' }, createdAt: new Date() }] },
    user: { findMany: async () => [] }, platformUser: { findMany: async () => [{ id: 'agent', name: 'Sam', role: 'PLATFORM_SUPPORT' }] },
  });
  const scope = [{ id: 'ticket', tenantId: 'tenant', createdById: 'requester' }];
  const staff = await presenter.history(scope, true);
  assert.equal(staff.get('ticket')[0].summary, 'Escalation requested: Private specialist context');
  assert.equal((await presenter.history(scope, false)).size, 0);
});

test('assignment, escalation, read acknowledgements and filter DTOs reject unsafe inputs', async () => {
  for (const [type, body] of [[dto.AssignSupportDto, { expectedRevision: 0 }], [dto.AssignSupportDto, { expectedRevision: -1, agentId: null }],
    [dto.EscalateSupportDto, { expectedRevision: 0, reason: '  x ' }], [dto.ReadSupportDto, { customerActivityVersion: 0 }],
    [dto.ListPlatformTicketsDto, { view: 'EVERYTHING', createdFrom: 'not-a-date' }], [dto.SupportBusinessesDto, { limit: 1000 }]])
    assert.ok((await validate(plainToInstance(type, body))).length, type.name);
  assert.equal((await validate(plainToInstance(dto.AssignSupportDto, { expectedRevision: 0, agentId: null }))).length, 0);
});
