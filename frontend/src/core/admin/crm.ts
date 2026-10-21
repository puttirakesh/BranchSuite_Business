import { CRM_LOG_MARKER, readCrmData } from '../leads';
import { timestampToDisplayDate } from './local';
import { quotesApi } from './quotes.api';

export type CrmRecord = {
  id: string; leadId: string; title: string; contact: string; branch: string; branchId?: string | null;
  status: string; value?: number; email: string; phone: string; notes: string;
  owner: string; assignedNames: string[]; source: string; closeDate: string;
};

/** Read each module from its own records, including records without a source lead. */
export async function readCrmWorkspace() {
  const data = await readCrmData();
  const quotes = await quotesApi.listCompany(data.companyId);
  const branches = new Map(data.branches.map(branch => [branch.id, branch.name]));
  const leads = new Map(data.leads.map(lead => [lead.id, lead]));
  const customers = new Map(data.customers.map(customer => [customer.id, customer]));
  const base = (branchId: string | null, leadId: string | null): Omit<CrmRecord, 'id' | 'title' | 'status'> => {
    const lead = leadId ? leads.get(leadId) : undefined;
    return {
      leadId: leadId ?? '', branchId, branch: branchId ? branches.get(branchId) ?? '' : '',
      contact: lead?.contactPerson ?? '', email: lead?.email ?? '', phone: lead?.phone ?? '',
      notes: '', owner: lead?.owner ?? 'Unassigned', assignedNames: lead?.owner && lead.owner !== 'Unassigned' ? lead.owner.split(', ') : [],
      source: lead?.source ?? '', closeDate: '',
    };
  };
  const label = (stage: string) => stage === 'DISCOVERY' ? 'New' : stage.charAt(0) + stage.slice(1).toLowerCase();
  const records = {
    deals: data.deals.map(deal => ({
      ...base(deal.branchId, deal.leadId), id: deal.id, title: deal.title,
      status: label(deal.stage), value: Number(deal.amount ?? 0), notes: deal.notes ?? '',
      closeDate: timestampToDisplayDate(deal.expectedCloseAt),
    })),
    customers: data.customers.map(customer => {
      const lead = data.leads.find(lead => lead.customer?.id === customer.id);
      return { ...base(customer.branchId, lead?.id ?? null), id: customer.id, title: customer.name,
        status: label(customer.status), email: customer.email ?? '', phone: customer.phone ?? '', notes: customer.notes ?? '' };
    }),
    quotes: quotes.map(quote => {
      const deal = data.deals.find(deal => deal.id === quote.dealId);
      return { ...base(quote.branchId, deal?.leadId ?? null), id: quote.id, title: quote.title,
        status: label(quote.status), value: Number(quote.total), notes: quote.notes ?? '' };
    }),
    activities: data.activities.map(activity => ({
      ...base(activity.branchId, activity.leadId), id: activity.id, title: activity.title,
      contact: activity.leadId ? leads.get(activity.leadId)?.organisation ?? '' : customers.get(activity.customerId ?? '')?.name ?? '',
      status: label(activity.status), notes: activity.description?.replace(CRM_LOG_MARKER, '') ?? '',
      closeDate: timestampToDisplayDate(activity.scheduledAt),
    })),
    support: [] as CrmRecord[],
  };
  return { leads: data.leads, records };
}
