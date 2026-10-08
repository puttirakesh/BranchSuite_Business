import { api } from '../../services/api';
import axios from 'axios';
import { WorkforceError } from './api';
import { Scope, Session } from './types';

export interface LoginScope extends Scope { permissions: string[]; companyName: string }
export interface LoginResult { accessToken: string; userId: string; scopes: LoginScope[] }
function validScopes(value: unknown): value is LoginScope[] {
  return Array.isArray(value) && value.every(item => item && typeof item === 'object'
    && ['tenantId', 'companyId', 'branchId', 'branchName', 'companyName'].every(key => typeof item[key] === 'string' && !!item[key])
    && Array.isArray(item.permissions) && item.permissions.every((permission: unknown) => typeof permission === 'string'));
}
export async function login(email: string, password: string): Promise<LoginResult> {
  if (!api.defaults.baseURL) throw new WorkforceError('The service is not configured. Contact your administrator.');
  let data: LoginResult;
  try { ({ data } = await api.post<LoginResult>('/auth/login', { email: email.trim().toLowerCase(), password })); }
  catch (cause) {
    if (axios.isAxiosError(cause) && cause.response?.status === 401) throw new WorkforceError('Email or password is incorrect.', 'auth');
    if (axios.isAxiosError(cause) && cause.response?.status === 403) throw new WorkforceError('Your account has no accessible branches. Contact your administrator.', 'forbidden');
    throw cause;
  }
  if (!data || typeof data.accessToken !== 'string' || !data.accessToken || typeof data.userId !== 'string' || !data.userId || !validScopes(data.scopes)) throw new WorkforceError('The server returned an unsupported session.');
  return data;
}
export async function availableScopes(session: Session) {
  if (!api.defaults.baseURL) throw new WorkforceError('The service is not configured. Contact your administrator.');
  const { data } = await api.get<{ userId: string; scopes: LoginScope[] }>('/auth/me', { headers: { Authorization: `Bearer ${session.accessToken}` } });
  if (!data || data.userId !== session.userId || !validScopes(data.scopes)) throw new WorkforceError('The server returned an unsupported branch list.');
  return data.scopes;
}
export async function logout(session: Session) {
  if (!api.defaults.baseURL) throw new WorkforceError('The service is not configured. Contact your administrator.');
  await api.post('/auth/logout', {}, { headers: { Authorization: `Bearer ${session.accessToken}` } });
}
export function selectedSession(result: Pick<LoginResult, 'accessToken' | 'userId'>, selected: LoginScope): Session {
  return { accessToken: result.accessToken, userId: result.userId,
    scope: { tenantId: selected.tenantId, companyId: selected.companyId, branchId: selected.branchId, branchName: selected.branchName, companyName: selected.companyName }, permissions: selected.permissions };
}
