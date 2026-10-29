export interface Offer { id: string; code: string; percent: number; maxUses: number; used: number; enabled: boolean; expiresOn: string; }
export interface Campaign { id: string; name: string; channel: string; coupon: string; status: string; notes: string; }
