import axios from 'axios';
import { api } from '../../services/api';
import { resources } from './resources';
import { EmployeeStatus, EmployeeSummary, PageResult, Resource, Session, WorkforceRecord } from './types';

export class WorkforceError extends Error {
  constructor(message: string, public readonly kind: 'offline' | 'auth' | 'forbidden' | 'error' = 'error') { super(message); }
}
export function asWorkforceError(error: unknown): WorkforceError {
  if (error instanceof WorkforceError) return error;
  if (axios.isAxiosError(error)) {
    if (!error.response) return new WorkforceError('Unable to reach the server. Check your connection and retry.', 'offline');
    if (error.response.status === 401) return new WorkforceError('Your session expired. Sign in again.', 'auth');
    if (error.response.status === 403) return new WorkforceError('You do not have permission for this action in this branch.', 'forbidden');
    if (error.response.status === 404) return new WorkforceError('This record is no longer available. Refresh the list.');
    if (error.response.status === 409) {
      if (error.response.data?.code === 'EMPLOYEE_EMAIL_EXISTS') return new WorkforceError('This branch already has an employee with that email.');
      return new WorkforceError('This record changed or the action was already completed. Refresh before trying again.');
    }
    if (error.response.status === 400 || error.response.status === 422) return new WorkforceError('The server rejected these details. Check the fields and try again.');
    if (error.response.status === 429) return new WorkforceError('Too many attempts. Wait a minute and try again.');
  }
  return new WorkforceError('Something went wrong. Please try again.');
}
export async function request<T>(session: Session, method: 'get' | 'post' | 'patch', url: string,
  options: { data?: unknown; params?: Record<string, string>; signal?: AbortSignal } = {}): Promise<T> {
  if (!api.defaults.baseURL) throw new WorkforceError('The service is not configured. Contact your administrator.');
  const response = await api.request<T>({ method, url, ...options, headers: {
    Authorization: `Bearer ${session.accessToken}`, 'X-Tenant-Id': session.scope.tenantId,
    'X-Company-Id': session.scope.companyId, 'X-Branch-Id': session.scope.branchId,
  } });
  return response.data;
}
function validRecord(value: unknown): value is WorkforceRecord {
  return !!value && typeof value === 'object' && typeof (value as WorkforceRecord).id === 'string'
    && Object.values(value).every(item => item === null || ['string', 'number', 'boolean'].includes(typeof item));
}
export async function listRecords(session: Session, resource: Resource, search: string, cursor?: string, signal?: AbortSignal, employeeStatus?: EmployeeStatus): Promise<PageResult> {
  const result = await request<PageResult>(session, 'get', resources[resource].endpoint, {
    params: { search, limit: '25', ...(cursor ? { cursor } : {}), ...(resource === 'employees' && employeeStatus ? { status: employeeStatus } : {}) }, signal,
  });
  return validPage(result);
}
function validPage(result: PageResult): PageResult {
  if (!result || !Array.isArray(result.items) || !result.items.every(validRecord)
    || !(result.nextCursor === null || typeof result.nextCursor === 'string')) throw new WorkforceError('The server returned an unsupported response. Contact your administrator.');
  return result;
}
export async function employeeOptions(session: Session, resource: Resource, search: string, cursor?: string, signal?: AbortSignal) {
  return validPage(await request<PageResult>(session, 'get', '/employees/options', {
    params: { forResource: resource, search, limit: '25', ...(cursor ? { cursor } : {}) }, signal,
  }));
}
export async function getRecord(session: Session, resource: Resource, id: string, signal?: AbortSignal) {
  const result = await request<WorkforceRecord>(session, 'get', `${resources[resource].endpoint}/${encodeURIComponent(id)}`, { signal });
  if (!validRecord(result)) throw new WorkforceError('The server returned an unsupported record.');
  return result;
}
export async function getEmployeeSummary(session: Session, signal?: AbortSignal): Promise<EmployeeSummary> {
  const result = await request<EmployeeSummary>(session, 'get', '/employees/summary', { signal });
  const count = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
  if (!result || ![result.total, result.active, result.inactive].every(count) || result.total !== result.active + result.inactive
    || !Array.isArray(result.departments) || !result.departments.every(item => item && typeof item.name === 'string' && count(item.count))
    || result.departments.reduce((total, item) => total + item.count, 0) !== result.total) throw new WorkforceError('The server returned an unsupported employee summary.');
  return result;
}
