import { api } from "../api/client";
import { call } from "./http";

export type DealStage =
  | "DISCOVERY"
  | "QUALIFIED"
  | "PROPOSAL"
  | "NEGOTIATION"
  | "WON"
  | "LOST";
export type DealDto = {
  id: string;
  tenantId: string;
  companyId: string;
  branchId: string | null;
  leadId: string | null;
  customerId: string | null;
  ownerId: string | null;
  title: string;
  amount: string | number | null;
  currency: string;
  stage: DealStage;
  notes: string | null;
  expectedCloseAt: string | null;
  closedAt: string | null;
  lossReason: string | null;
  createdAt: string;
  updatedAt: string;
};
export type DealCreate = {
  companyId: string;
  branchId?: string;
  leadId?: string;
  customerId?: string;
  title: string;
  amount?: string;
  currency?: string;
  notes?: string;
  expectedCloseAt?: string;
  ownerId?: string;
};

export type DealOwner = { id: string; name: string; email: string };
export type DealStageHistoryItem = {
  id: string;
  dealId: string;
  fromStage: DealStage;
  toStage: DealStage;
  changedById: string;
  reason: string | null;
  createdAt: string;
};

export const dealsApi = {
  reopen: (id: string, reason: string) => call(api.post<DealDto>(`/deals/${id}/reopen`, { reason })),
  list: (companyId: string, branchId?: string) =>
    call(
      api.get<DealDto[]>("/deals", {
        params: { companyId, ...(branchId ? { branchId } : {}) },
      }),
    ),
  owners: (companyId: string, branchId?: string) =>
    call(
      api.get<DealOwner[]>("/deals/owners", {
        params: { companyId, ...(branchId ? { branchId } : {}) },
      }),
    ),
  history: (id: string) =>
    call(api.get<DealStageHistoryItem[]>(`/deals/${id}/history`)),
  get: (id: string) => call(api.get<DealDto>(`/deals/${id}`)),
  create: (body: DealCreate) => call(api.post<DealDto>("/deals", body)),
  update: (
    id: string,
    body: Partial<Omit<DealCreate, "companyId" | "branchId" | "amount" | "customerId" | "leadId" | "expectedCloseAt">> & {
      amount?: string | null; customerId?: string | null; leadId?: string | null; expectedCloseAt?: string | null;
    },
  ) => call(api.patch<DealDto>(`/deals/${id}`, body)),
  transition: (id: string, stage: DealStage, lossReason?: string) =>
    call(
      api.post<DealDto>(`/deals/${id}/transition`, {
        stage,
        ...(lossReason ? { lossReason } : {}),
      }),
    ),
};
