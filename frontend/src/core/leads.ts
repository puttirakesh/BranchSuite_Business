
import { activitiesApi, leadsApi, type ActivityDto, type LeadStage } from './admin/api';
import { getAdminScope, getCompanyBranches, branchNameMap, resolveBranchId } from './admin/scope';
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
  opportunity?: { id: string; name: string; estimatedValue: number; createdAt: string; stage?: string; incentivePending?: boolean; quotes?: Quote[] };
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
    case 'Proposal': case 'Negotiation': return 'PROPOSAL';
    case 'Active': return 'WON';
    case 'Inactive': return 'LOST';
    default: return 'NEW';
  }
};
const fromApiStage: Record<LeadStage, string> = {
  NEW: 'New', CONTACTED: 'Contacted', QUALIFIED: 'Qualified', PROPOSAL: 'Proposal', WON: 'Active', LOST: 'Inactive',
};

let snapshot: { leads: Map<string, Lead>; followUps: Map<string, ActivityDto> } | null = null;

export async function readLeads(): Promise<Lead[]> {
  const scope = await getAdminScope();
  const [leads, activities, branches, extras, employees] = await Promise.all([
    leadsApi.list(scope.companyId),
    activitiesApi.list(scope.companyId),
    getCompanyBranches(),
    readExtras<LeadExtras>(extrasKeys.leads),
    getEmployees().catch(() => []),
  ]);
  const branchNames = branchNameMap(branches);
  const names = new Map(employees.map(employee => [employee.id, employee.fullName]));
  names.set(scope.user.id, scope.user.name);

  const followUps = new Map<string, ActivityDto>();
  const result = leads.map(dto => {
    const extra = extras[dto.id] ?? {};
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

    const assignedEmployeeIds = dto.assignedToId
      ? (extra.assignedEmployeeIds?.[0] === dto.assignedToId ? extra.assignedEmployeeIds : [dto.assignedToId])
      : [];
    const stage = dto.stage === 'PROPOSAL' && extra.stageOverride ? extra.stageOverride : fromApiStage[dto.stage];

    const lead: Lead = {
      id: dto.id,
      createdAt: dto.createdAt,
      organisation: dto.name,
      contactPerson: extra.contactPerson ?? '',
      email: dto.email ?? '',
      phone: dto.phone ?? '',
      source: extra.source ?? 'Other',
      owner: assignedEmployeeIds.map(id => names.get(id) ?? 'Team member').join(', ') || 'Unassigned',
      branch: dto.branchId ? branchNames.get(dto.branchId) ?? '' : '',
      stage,
      estimatedValue: extra.estimatedValue ?? 0,
      followUpDate: followUp ? timestampToDisplayDate(followUp.scheduledAt) : extra.followUpDate ?? '',
      notes: dto.notes ?? '',
      assignedEmployeeIds,
      history,
      ...(extra.opportunity ? { opportunity: extra.opportunity } : {}),
      ...(extra.customer ? { customer: extra.customer } : {}),
    };
    return lead;
  });

  snapshot = { leads: new Map(result.map(lead => [lead.id, lead])), followUps };
  return result;
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
export async function saveLeads(next: Lead[]): Promise<void> {
  if (!snapshot) await readLeads();
  const previous = snapshot!;
  const scope = await getAdminScope();
  const branches = (await getCompanyBranches()).filter(branch => branch.status === 'ACTIVE');
  const extras = await readExtras<LeadExtras>(extrasKeys.leads);

  try {
    for (const lead of next) {
      const before = previous.leads.get(lead.id);
      if (before && JSON.stringify(before) === JSON.stringify(lead)) continue;

      const branchId = resolveBranchId(branches, lead.branch);
      const assignee = lead.assignedEmployeeIds?.[0] ?? null;
      const scheduledAt = displayDateToTimestamp(lead.followUpDate);

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
        });
        extras[created.id] = extrasFor(lead);
        await writeExtras(extrasKeys.leads, extras);
        if (scheduledAt) {
          await activitiesApi.create({
            companyId: scope.companyId, ...(created.branchId ? { branchId: created.branchId } : {}),
            leadId: created.id, type: 'FOLLOW_UP', title: `Follow up: ${created.name}`,
            scheduledAt, assignedToId: assignee,
          });
        }
        if (toApiStage(lead.stage) !== 'NEW') await leadsApi.setStage(created.id, toApiStage(lead.stage));
        continue;
      }

      // ---- existing lead: core fields
      const coreChanged = before.organisation !== lead.organisation || before.email !== lead.email
        || before.phone !== lead.phone || before.notes !== lead.notes || before.branch !== lead.branch;
      if (coreChanged) {
        await leadsApi.update(lead.id, {
          name: lead.organisation.trim(),
          email: blankToNull(lead.email),
          phone: blankToNull(lead.phone),
          notes: blankToNull(lead.notes),
          ...(branchId ? { branchId } : {}),
        });
      }
      if ((before.assignedEmployeeIds?.[0] ?? null) !== assignee) await leadsApi.assign(lead.id, assignee);

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
      if (before.followUpDate !== lead.followUpDate && scheduledAt) {
        const followUp = previous.followUps.get(lead.id);
        if (followUp) await activitiesApi.update(followUp.id, { scheduledAt });
        else await activitiesApi.create({
          companyId: scope.companyId, ...(branchId ? { branchId } : {}), leadId: lead.id,
          type: 'FOLLOW_UP', title: `Follow up: ${lead.organisation}`, scheduledAt, assignedToId: assignee,
        });
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
}
