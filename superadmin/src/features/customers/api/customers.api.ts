import { apiClient } from '../../../core/api/client';
import { endpoints } from '../../../core/api/endpoints';
import type { BusinessDetails, BusinessListResponse, BusinessStatus } from '../types';

export async function listBusinesses(params: { search?: string; status?: BusinessStatus; page?: number; limit?: number } = {}, signal?: AbortSignal) {
  const result = await apiClient.get<BusinessListResponse>(endpoints.customers, {
    params, signal,
  });
  return result.data;
}

export async function getBusiness(id: string, signal?: AbortSignal) {
  const result = await apiClient.get<BusinessDetails>(`${endpoints.customers}/${encodeURIComponent(id)}`, {
    signal,
  });
  return result.data;
}

export async function updateBusinessStatus(id: string, status: BusinessStatus) {
  const result = await apiClient.patch<{ id: string; status: BusinessStatus; changed: boolean }>(
    `${endpoints.customers}/${encodeURIComponent(id)}/status`, { status },
  );
  return result.data;
}
