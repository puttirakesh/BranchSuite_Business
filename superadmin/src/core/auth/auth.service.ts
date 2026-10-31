import { apiClient } from '../api/client';
import { endpoints } from '../api/endpoints';
import { isPlatformRole } from '../permissions/roles';
import type { LoginResponse, PlatformUser } from './auth.types';

export class InvalidSessionError extends Error {}

function requirePlatformUser(value: unknown): asserts value is PlatformUser {
  if (!value || typeof value !== 'object' ||
    !('id' in value) || typeof value.id !== 'string' || !value.id ||
    !('name' in value) || typeof value.name !== 'string' ||
    !('email' in value) || typeof value.email !== 'string' ||
    !('role' in value) || !isPlatformRole(value.role)) {
    throw new InvalidSessionError('Invalid platform account response. Please sign in again.');
  }
}

export async function signIn(email: string, password: string): Promise<LoginResponse> {
  const { data } = await apiClient.post<LoginResponse>(endpoints.auth.login, { email, password }, {
    headers: { Authorization: null },
  });
  requirePlatformUser(data?.user);
  if (typeof data.accessToken !== 'string' || !data.accessToken || data.tokenType !== 'Bearer') {
    throw new InvalidSessionError('Invalid platform login response.');
  }
  return data;
}

export async function getProfile(token: string): Promise<PlatformUser> {
  const { data } = await apiClient.get<PlatformUser>(endpoints.auth.profile, {
    headers: { Authorization: `Bearer ${token}` },
  });
  requirePlatformUser(data);
  return data;
}

export async function signOut(token: string): Promise<void> {
  await apiClient.post(endpoints.auth.logout, {}, { headers: { Authorization: `Bearer ${token}` } });
}
