import AsyncStorage from '@react-native-async-storage/async-storage';

export type LeadForm = {
  organisation: string; contactPerson: string; email: string; phone: string;
  source: string; owner: string; branch: string; stage: string;
  estimatedValue: string; followUpDate: string; notes: string;
};
export type LeadActivity = { id: string; kind: 'call' | 'activity' | 'edit' | 'opportunity' | 'customer'; note: string; createdAt: string };
export type Lead = Omit<LeadForm, 'estimatedValue'> & {
  id: string; createdAt: string; estimatedValue: number; history?: LeadActivity[];
  opportunity?: { id: string; name: string; estimatedValue: number; createdAt: string };
  customer?: { id: string; organisation: string; contactPerson: string; email: string; phone: string; createdAt: string };
};
export const leadsKey = 'branchsuite:leads:v1';
export const normalizeLeadStage = (stage: string) => stage === 'Won' ? 'Active' : stage === 'Lost' ? 'Inactive' : stage;
export const newLeadId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
export async function readLeads(): Promise<Lead[]> {
  const stored = await AsyncStorage.getItem(leadsKey);
  const leads: unknown = stored === null ? [] : JSON.parse(stored);
  const fields = ['id', 'createdAt', 'organisation', 'contactPerson', 'email', 'phone', 'source', 'owner', 'branch', 'stage', 'followUpDate', 'notes'];
  if (!Array.isArray(leads) || !leads.every(lead => lead && fields.every(key => typeof lead[key] === 'string') && typeof lead.estimatedValue === 'number' && Number.isFinite(lead.estimatedValue)
    && (lead.history === undefined || (Array.isArray(lead.history) && lead.history.every((entry: LeadActivity) => entry && typeof entry.id === 'string' && typeof entry.note === 'string' && typeof entry.createdAt === 'string'))))) {
    throw new Error('Saved leads could not be read.');
  }
  return (leads as Lead[]).map(lead => ({ ...lead, stage: normalizeLeadStage(lead.stage) }));
}
