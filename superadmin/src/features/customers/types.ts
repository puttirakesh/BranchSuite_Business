export type BusinessStatus = 'ACTIVE' | 'INACTIVE';

export interface BusinessSummary {
  id: string;
  name: string;
  status: BusinessStatus;
  createdAt: string;
  updatedAt: string;
  companyCount: number;
  userCount: number;
  subscription: null | { status: string; planId: string; billingCycle: string };
}

export interface BusinessListResponse {
  items: BusinessSummary[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface BusinessDetails extends BusinessSummary {
  companies: Array<{ id: string; name: string; status: BusinessStatus; branchCount: number; createdAt: string }>;
  subscription: null | { id: string; status: string; planId: string; billingCycle: string; createdAt: string; updatedAt: string };
}
