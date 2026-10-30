export type SubscriptionStatus = 'Active' | 'Trial' | 'Past due' | 'Expired' | 'Suspended' | 'Cancelled';
export interface Customer { id: string; name: string; industry: string; owner: string; email: string; companyIds: string[]; subscription: { planId: string; cycle: string; status: SubscriptionStatus; renewOn: string; trialEndsOn: string; graceEndsOn: string; cancelAtRenewal: boolean; }; }
