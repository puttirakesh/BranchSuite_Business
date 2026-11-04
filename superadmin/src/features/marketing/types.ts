export const PROSPECT_STAGES = ['New', 'Contacted', 'Qualified', 'Converted', 'Closed'] as const;
export type ProspectStage = (typeof PROSPECT_STAGES)[number];

export interface Prospect {
  id: string;
  business: string;
  contact: string;
  email: string;
  phone: string;
  industry: string;
  employees: number;
  source: string;
  status: ProspectStage;
  followup: string;
  notes: string;
  convertedCustomerName: string | null;
}
