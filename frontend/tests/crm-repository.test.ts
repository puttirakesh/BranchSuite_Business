/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
import type { Lead } from '../src/core/leads';

// Isolate native storage and HTTP at the repository boundary without loading a native runtime.
function fixture(options: { localHistory?: any[] } = {}) {
  const leadId = '11111111-1111-4111-8111-111111111111';
  const createdId = '22222222-2222-4222-8222-222222222222';
  const branch = { id: 'branch', name: 'North' };
  const rows: Record<string, any>[] = [{ id: leadId, createdAt: '2026-10-17T10:00:00Z', branchId: branch.id, name: 'Existing lead', contactPerson: 'Server contact', source: 'Referral', estimatedValue: '1250.50', assignedToId: 'owner', assignedEmployeeIds: ['owner'], stage: 'NEW', email: null, phone: null, notes: null, convertedCustomerId: null }];
  const deals: Record<string, any>[] = [];
  const activities: Record<string, any>[] = [{ id: 'follow-up', leadId, branchId: branch.id, type: 'FOLLOW_UP', status: 'PENDING', scheduledAt: '2026-10-19T10:00:00Z', assignedToId: 'owner' }];
  const calls: { action: string; body?: any }[] = [];
  const persistedHistory: Record<string, any>[] = [];
  let extras: Record<string, any> = { [leadId]: { contactPerson: 'Stale contact', estimatedValue: 1, history: options.localHistory ?? [] } };
  const dependencies: Record<string, unknown> = {
    './admin/deals.api': { dealsApi: { list: async () => deals, create: async (body: any) => { calls.push({ action: 'deal.create', body }); const deal = { ...body, id: 'real-deal', stage: 'DISCOVERY', amount: body.amount, createdAt: new Date().toISOString() }; deals.push(deal); return deal; } } },
    './admin/available-branches': { getAvailableBranches: async () => [branch] },
    './admin/scope': { getAdminScope: async () => ({ companyId: 'company', user: { id: 'owner', name: 'Owner' } }), getBranchDirectory: async () => [branch], branchNameMap: () => new Map([[branch.id, branch.name]]), resolveBranchId: () => branch.id },
    './employees': { getEmployees: async () => [] },
    './admin/local': {
      extrasKeys: { leads: 'extras' }, readExtras: async () => structuredClone(extras), writeExtras: async (_key: string, value: any) => { extras = structuredClone(value); },
      timestampToDisplayDate: (value: string) => { const date = new Date(value); return `${String(date.getUTCDate()).padStart(2, '0')}/${String(date.getUTCMonth() + 1).padStart(2, '0')}/${date.getUTCFullYear()}`; },
      displayDateToTimestamp: (value: string) => value ? `${value.slice(6)}-${value.slice(3, 5)}-${value.slice(0, 2)}T10:00:00Z` : null,
    },
    './admin/api': {
      leadsApi: {
        list: async () => rows,
        history: async () => persistedHistory,
        addHistory: async (id: string, body: any) => {
          calls.push({ action: 'history.add', body });
          const entry = { ...body, leadId: id, actorId: 'owner', createdAt: new Date().toISOString() };
          persistedHistory.push(entry);
          return entry;
        },
        create: async (body: any) => {
          calls.push({ action: 'lead.create', body });
          const created = { ...rows[0], ...body, assignedToId: body.assignedEmployeeIds?.[0] ?? null, id: createdId, stage: body.stage ?? 'NEW' };
          if (body.opportunity) deals.push({ id: 'real-deal', leadId: createdId, title: body.opportunity.title, amount: body.opportunity.amount, stage: 'DISCOVERY', createdAt: created.createdAt });
          rows.push(created); return created;
        },
        update: async (id: string, body: any) => { calls.push({ action: 'lead.update', body }); Object.assign(rows.find(row => row.id === id)!, body); },
        setStage: async (id: string, stage: string) => { rows.find(row => row.id === id)!.stage = stage; },
      },
      customersApi: { list: async () => [] },
      activitiesApi: {
        list: async () => activities,
        cancel: async (id: string) => { calls.push({ action: 'activity.cancel', body: id }); activities.find(row => row.id === id)!.status = 'CANCELLED'; },
        update: async (id: string, body: any) => { calls.push({ action: 'activity.update', body }); Object.assign(activities.find(row => row.id === id)!, body); },
        create: async (body: any) => { calls.push({ action: 'activity.create', body }); const created = { ...body, id: 'new-activity', status: 'PENDING' }; activities.push(created); return created; },
      },
    },
  };
  const output = ts.transpileModule(readFileSync(new URL('../src/core/leads.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const exports: Record<string, any> = {};
  new Function('require', 'exports', output)((name: string) => {
    if (!(name in dependencies)) throw new Error(`Unexpected native dependency: ${name}`);
    return dependencies[name];
  }, exports);
  return { repository: exports as { readLeads: () => Promise<Lead[]>; saveLeads: (leads: Lead[]) => Promise<Lead[]> }, calls, createdId };
}

test('CRM uses persisted metadata and cancels a removed follow-up', async () => {
  const { repository, calls } = fixture();
  const leads = await repository.readLeads();
  assert.equal(leads[0].contactPerson, 'Server contact'); assert.equal(leads[0].estimatedValue, 1250.5);
  const saved = await repository.saveLeads([{ ...leads[0], followUpDate: '' }]);
  assert.ok(calls.some(call => call.action === 'activity.cancel' && call.body === 'follow-up'));
  assert.equal(saved[0].followUpDate, '');
});

test('creating a lead and opportunity returns real server IDs and persists metadata', async () => {
  const { repository, calls, createdId } = fixture();
  const leads = await repository.readLeads();
  const lead: Lead = { ...leads[0], id: 'draft-lead', organisation: 'New organisation', followUpDate: '', opportunity: { id: 'temporary-deal', name: 'New deal', estimatedValue: 5000, createdAt: new Date().toISOString() } };
  const saved = await repository.saveLeads([...leads, lead]);
  assert.equal(lead.id, createdId);
  assert.equal(saved.find(row => row.id === createdId)?.opportunity?.id, 'real-deal');
  assert.equal(calls.find(call => call.action === 'lead.create')?.body.opportunity.title, 'New deal');
  assert.equal(calls.some(call => call.action === 'deal.create'), false);
  assert.equal(calls.find(call => call.action === 'lead.create')?.body.contactPerson, 'Server contact');
});

test('CRM rejects unknown branches before sending writes', async () => {
  const { repository, calls } = fixture();
  const leads = await repository.readLeads();
  await assert.rejects(repository.saveLeads([{ ...leads[0], branch: 'Unknown branch' }]), /available branch/);
  assert.deepEqual(calls, []);
});

test('CRM migrates old local history once and reads it back from the backend', async () => {
  const localEntry = { id: 'local-history-1', kind: 'edit', note: 'Imported from this device', createdAt: '2026-10-17T10:00:00Z' };
  const { repository, calls } = fixture({ localHistory: [localEntry] });
  const leads = await repository.readLeads();
  assert.equal(leads[0].history?.[0]?.id, localEntry.id);

  const saved = await repository.saveLeads(leads);
  assert.equal(saved[0].history?.some(entry => entry.id === localEntry.id), true);
  assert.equal(calls.filter(call => call.action === 'history.add').length, 1);
  assert.equal(calls.find(call => call.action === 'history.add')?.body.id, localEntry.id);

  await repository.saveLeads(saved);
  assert.equal(calls.filter(call => call.action === 'history.add').length, 1);
});
