export interface Offer {
  id: string;
  code: string;
  /** The APK only creates percentage offers; the backend also supports fixed amounts. */
  discountType: 'PERCENT' | 'FIXED';
  discount: number;
  maxUses: number | null;
  used: number | null;
  enabled: boolean;
  expiresOn: string;
}

export const CAMPAIGN_CHANNELS = ['Website', 'Partner', 'Email', 'Social media', 'Sales team'] as const;
export const CAMPAIGN_STATUSES = ['Draft', 'Active', 'Paused', 'Completed'] as const;
export type CampaignChannel = (typeof CAMPAIGN_CHANNELS)[number];
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export interface Campaign {
  id: string;
  name: string;
  channel: CampaignChannel;
  offerCode: string;
  status: CampaignStatus;
  notes: string;
}
