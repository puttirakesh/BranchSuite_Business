import { dealsApi } from './admin/deals.api';
import { getAvailableBranches } from "./admin/available-branches";

import { activitiesApi, leadsApi, customersApi, type ActivityDto, type LeadStage } from './admin/api';
import { getAdminScope, getBranchDirectory, branchNameMap, resolveBranchId } from './admin/scope';
import { displayDateToTimestamp, extrasKeys, readExtras, timestampToDisplayDate, writeExtras } from './admin/local';
import { getEmployees } from './employees';

export type LeadForm = {
  organisation: string; contactPerson: string; email: string; phone: string;
  source: string; owner: string; branch: string; stage: string;
  estimatedValue: string; followUpDate: string; notes: string;
};
export type LeadActivity = { id: string; kind: 'call' | 'activity' | 'edit' | 'opportunity' | 'customer' | 'stage'; note: string; createdAt: string; actor?: string };
export type Quote = {
  id: string; name: string; value: number; createdAt: string;
  customer?: string; branch?: string; validUntil?: string;
  items?: { description: string; quantity: number; unitRate: number }[];
  discount?: number; taxRate?: number; terms?: string;
  status?: 'Draft' | 'Approved'; approvedAt?: string;
};
export type Lead = Omit<LeadForm, 'estimatedValue'> & {
  assignedEmployeeIds?: string[];
  id: string; createdAt: string; estimatedValue: number; history?: LeadActivity[];
  opportunity?: { id: string; name: string; estimatedValue: number; createdAt: string; stage?: string; quotes?: Quote[] };
  customer?: { id: string; organisation: string; contactPerson: string; email: string; phone: string; createdAt: string };
};

/** Kept for compatibility: pages pass this key to the storage adapter, which routes it to the API. */
export const leadsKey = 'branchsuite:leads:v1';
export const normalizeLeadStage = (stage: string) => stage === 'Won' ? 'Active' : stage === 'Lost' ? 'Inactive' : stage;
export const newLeadId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

type LeadExtras = Partial<Pick<Lead, 'contactPerson' | 'source' | 'estimatedValue' | 'opportunity' | 'customer' | 'assignedEmployeeIds'>> & {
  stageOverride?: string;
  history?: LeadActivity[];
  followUpDate?: string;
};

/** Marks activities created from a lead's "Log call / Add activity" so the Tasks pages can skip them. */
export const CRM_LOG_MARKER = '[crm-log] ';
const LOGGED_KINDS: LeadActivity['kind'][] = ['call', 'activity'];

const toApiStage = (stage: string): LeadStage => {
  switch (normalizeLeadStage(stage)) {
    case 'Contacted': return 'CONTACTED';
    case 'Qualified': return 'QUALIFIED';
    case 'Proposal': return 'PROPOSAL';
    case 'Negotiation': return 'NEGOTIATION';
    case 'Active': return 'WON';
    case 'Inactive': return 'LOST';
    default: return 'NEW';
  }
};
const fromApiStage: Record<LeadStage, string> = {
  NEW: 'New', CONTACTED: 'Contacted', QUALIFIED: 'Qualified', PROPOSAL: 'Proposal', NEGOTIATION: 'Negotiation', WON: 'Active', LOST: 'Inactive',
};

let snapshot: { scopeKey: string; leads: Map<string, Lead>; followUps: Map<string, ActivityDto> } | null = null;

export async function readCrmData() {
  const scope = await getAdminScope();
  const [leads, activities, branches, extras, employees, deals, customers] = await Promise.all([
    leadsApi.list(scope.companyId),
    activitiesApi.list(scope.companyId),
    getBranchDirectory(),
    readExtras<LeadExtras>(extrasKeys.leads),
    getEmployees().catch(() => []),
    dealsApi.list(scope.companyId),
    customersApi.list(scope.companyId),
  ]);
  const branchNames = branchNameMap(branches);
  const names = new Map(employees.map(employee => [employee.id, employee.fullName]));
  names.set(scope.user.id, scope.user.name);

  const followUps = new Map<string, ActivityDto>();
  const result = leads.map(dto => {
    const extra = extras[dto.id] ?? {};
    const deal = deals.find(item => item.leadId === dto.id);
    const customer = customers.find(item => item.id === dto.convertedCustomerId);
    const related = activities.filter(activity => activity.leadId === dto.id);
    const followUp = related
      .filter(activity => activity.type === 'FOLLOW_UP' && activity.status === 'PENDING')
      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))[0];
    if (followUp) followUps.set(dto.id, followUp);

    const logged: LeadActivity[] = related
      .filter(activity => activity.description?.startsWith(CRM_LOG_MARKER))
      .map(activity => ({
        id: activity.id,
        kind: activity.type === 'CALL' ? 'call' : 'activity',
        note: activity.description!.slice(CRM_LOG_MARKER.length),
        createdAt: activity.completedAt ?? activity.createdAt,
      }));
    const history = [...(extra.history ?? []), ...logged].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    const assignedEmployeeIds = dto.assignedEmployeeIds?.length ? dto.assignedEmployeeIds : dto.assignedToId
      ? (extra.assignedEmployeeIds?.[0] === dto.assignedToId ? extra.assignedEmployeeIds : [dto.assignedToId])
      : [];
    const stage = dto.stage === 'PROPOSAL' && extra.stageOverride ? extra.stageOverride : fromApiStage[dto.stage];

    const lead: Lead = {
      id: dto.id,
      createdAt: dto.createdAt,
      organisation: dto.name,
      contactPerson: dto.contactPerson ?? extra.contactPerson ?? '',
      email: dto.email ?? '',
      phone: dto.phone ?? '',
      source: dto.source ?? extra.source ?? 'Other',
      owner: assignedEmployeeIds.map(id => names.get(id) ?? 'Team member').join(', ') || 'Unassigned',
      branch: dto.branchId ? branchNames.get(dto.branchId) ?? '' : '',
      stage,
      estimatedValue: Number(dto.estimatedValue ?? extra.estimatedValue ?? 0),
      followUpDate: followUp ? timestampToDisplayDate(followUp.scheduledAt) : '',
      notes: dto.notes ?? '',
      assignedEmployeeIds,
      history,
      ...(deal ? { opportunity: { id: deal.id, name: deal.title, estimatedValue: Number(deal.amount ?? 0), createdAt: deal.createdAt, stage: deal.stage === 'DISCOVERY' ? 'New' : deal.stage.charAt(0) + deal.stage.slice(1).toLowerCase() } } : {}),
      ...(customer ? { customer: { id: customer.id, organisation: customer.name, contactPerson: dto.contactPerson ?? extra.contactPerson ?? '', email: customer.email ?? '', phone: customer.phone ?? '', createdAt: customer.createdAt } } : {}),
    };
    return lead;
  });

  snapshot = { scopeKey: `${scope.user.id}:${scope.companyId}`, leads: new Map(result.map(lead => [lead.id, lead])), followUps };
  return { leads: result, deals, customers, activities, branches, companyId: scope.companyId };
}

export async function readLeads(): Promise<Lead[]> {
  return (await readCrmData()).leads;
}

function extrasFor(lead: Lead): LeadExtras {
  return {
    contactPerson: lead.contactPerson,
    source: lead.source,
    estimatedValue: lead.estimatedValue,
    opportunity: lead.opportunity,
    customer: lead.customer,
    assignedEmployeeIds: lead.assignedEmployeeIds,
    stageOverride: lead.stage === 'Negotiation' ? 'Negotiation' : undefined,
    // Logged calls/activities live in the backend; everything else is an on-device audit trail.
    history: (lead.history ?? []).filter(entry => !LOGGED_KINDS.includes(entry.kind)),
    followUpDate: lead.followUpDate,
  };
}

const blankToNull = (value: string) => value.trim() ? value.trim() : null;

/** Persists the leads array the admin pages built, sending only what changed since the last read. */
export async function saveLeads(next: Lead[]): Promise<Lead[]> {
  const scope = await getAdminScope();
  if (!snapshot || snapshot.scopeKey !== `${scope.user.id}:${scope.companyId}`) await readLeads();
  const previous = snapshot!;
  const branches = await getAvailableBranches();
  const extras = await readExtras<LeadExtras>(extrasKeys.leads);

  try {
    for (const lead of next) {
      const before = previous.leads.get(lead.id);
      if (before && JSON.stringify(before) === JSON.stringify(lead)) continue;

      if (!before && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(lead.id)) throw new Error('This lead is no longer available in the selected workspace. Refresh and retry.');
      const branchId = lead.branch ? resolveBranchId(branches, lead.branch) : undefined;
      if (lead.branch && !branches.some(branch => branch.id === branchId && branch.name.toLowerCase() === lead.branch.trim().toLowerCase())) throw new Error('Select an available branch before saving.');
      const assignee = lead.assignedEmployeeIds?.[0] ?? null;
      const scheduledAt = displayDateToTimestamp(lead.followUpDate);
      if (lead.followUpDate.trim() && !scheduledAt) throw new Error('Enter a valid follow-up date.');
      const metadata = {
        contactPerson: lead.contactPerson.trim(), source: lead.source.trim(),
        estimatedValue: String(lead.estimatedValue), assignedEmployeeIds: lead.assignedEmployeeIds ?? [],
      };
      if (!Number.isFinite(lead.estimatedValue) || lead.estimatedValue < 0) throw new Error('Enter a valid estimated value.');
      if (!before && toApiStage(lead.stage) === 'WON') throw new Error('Create and qualify the lead before converting it to a customer.');

      if (!before) {
        // ---- new lead
        const created = await leadsApi.create({
          companyId: scope.companyId,
          ...(branchId ? { branchId } : {}),
          name: lead.organisation.trim(),
          ...(lead.email.trim() ? { email: lead.email.trim() } : {}),
          ...(lead.phone.trim() ? { phone: lead.phone.trim() } : {}),
          ...(lead.notes.trim() ? { notes: lead.notes.trim() } : {}),
          assignedToId: assignee,
          ...metadata,
          stage: toApiStage(lead.stage),
          ...(scheduledAt ? { followUpAt: scheduledAt } : {}),
          ...(lead.opportunity ? { opportunity: { title: lead.opportunity.name, amount: String(lead.opportunity.estimatedValue) } } : {}),
        });
        extras[created.id] = extrasFor(lead);
        await writeExtras(extrasKeys.leads, extras);
        // The caller receives the server ID, including when it navigates after creation.
        lead.id = created.id;
        continue;
      }

      // ---- existing lead: core fields
      const coreChanged = before.organisation !== lead.organisation || before.email !== lead.email
        || before.phone !== lead.phone || before.notes !== lead.notes || before.branch !== lead.branch
        || before.contactPerson !== lead.contactPerson || before.source !== lead.source
        || before.estimatedValue !== lead.estimatedValue
        || JSON.stringify(before.assignedEmployeeIds ?? []) !== JSON.stringify(lead.assignedEmployeeIds ?? []);
      if (coreChanged) {
        await leadsApi.update(lead.id, {
          name: lead.organisation.trim(),
          email: blankToNull(lead.email),
          phone: blankToNull(lead.phone),
          notes: blankToNull(lead.notes),
          branchId: branchId ?? null,
          ...metadata,
        });
      }
      if (!before.opportunity && lead.opportunity) await dealsApi.create({
        companyId: scope.companyId, ...(branchId ? { branchId } : {}), leadId: lead.id,
        title: lead.opportunity.name, amount: String(lead.opportunity.estimatedValue),
      });

      // ---- newly logged calls / activities
      const knownIds = new Set((before.history ?? []).map(entry => entry.id));
      for (const entry of lead.history ?? []) {
        if (knownIds.has(entry.id) || !LOGGED_KINDS.includes(entry.kind)) continue;
        const activity = await activitiesApi.create({
          companyId: scope.companyId, ...(branchId ? { branchId } : {}), leadId: lead.id,
          type: entry.kind === 'call' ? 'CALL' : 'MEETING',
          title: entry.kind === 'call' ? `Call: ${lead.organisation}` : `Activity: ${lead.organisation}`,
          description: `${CRM_LOG_MARKER}${entry.note}`,
          scheduledAt: new Date().toISOString(),
        });
        await activitiesApi.complete(activity.id);
      }

      // ---- follow-up date
      if ((before.followUpDate !== lead.followUpDate || (before.assignedEmployeeIds?.[0] ?? null) !== assignee) && scheduledAt) {
        const followUp = previous.followUps.get(lead.id);
        if (followUp) await activitiesApi.update(followUp.id, { scheduledAt, assignedToId: assignee });
        else await activitiesApi.create({
          companyId: scope.companyId, ...(branchId ? { branchId } : {}), leadId: lead.id,
          type: 'FOLLOW_UP', title: `Follow up: ${lead.organisation}`, scheduledAt, assignedToId: assignee,
        });
      } else if (before.followUpDate !== lead.followUpDate && !scheduledAt) {
        const pending = (await activitiesApi.list(scope.companyId)).filter(activity => activity.leadId === lead.id && activity.type === 'FOLLOW_UP' && activity.status === 'PENDING');
        for (const followUp of pending) await activitiesApi.cancel(followUp.id);
      }

      // ---- conversion or stage change (last: WON leads are locked by the backend)
      const extra = extrasFor(lead);
      if (!before.customer && lead.customer) {
        const converted = await leadsApi.convert(lead.id);
        extra.customer = { ...lead.customer, id: converted.customer.id, createdAt: converted.customer.createdAt };
      } else if (toApiStage(before.stage) !== toApiStage(lead.stage)) {
        await leadsApi.setStage(lead.id, toApiStage(lead.stage));
      }
      extras[lead.id] = extra;
      await writeExtras(extrasKeys.leads, extras);
    }
  } finally {
    // Force the next read to reflect server state (new ids, partial saves).
    snapshot = null;
  }
  return readLeads();
}
