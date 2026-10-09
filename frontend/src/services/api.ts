import axios from 'axios';
import type { Scope } from '../types';
import { InputValidationError } from '../utils/validation';

export const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
  timeout: 15000,
});

let accessToken: string | null = null;
let sessionExpired: (() => void) | undefined;
export function configureSession(token: string | null, onExpired?: () => void) {
  accessToken = token; sessionExpired = onExpired;
}
api.interceptors.request.use((config) => {
  if (!config.baseURL) throw new Error('Set EXPO_PUBLIC_API_URL in frontend/.env to connect to your backend.');
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});
api.interceptors.response.use((response) => response, (error: unknown) => {
  if (axios.isAxiosError(error) && error.response?.status === 401 &&
      error.config?.headers.Authorization === `Bearer ${accessToken}` && !error.config?.url?.startsWith('/auth/')) sessionExpired?.();
  return Promise.reject(error);
});
export function scopeHeaders(scope: Scope) {
  return { 'X-Tenant-Id': scope.tenantId, 'X-Company-Id': scope.companyId, 'X-Branch-Id': scope.branchId };
}
export function errorMessage(error: unknown): string {
  if (error instanceof InputValidationError) return error.message;
  if (axios.isAxiosError(error)) {
    if (!error.response) return 'Cannot reach the server. Check your connection and try again.';
    switch (error.response.status) {
      case 401: return 'Your session has expired. Please sign in again.';
      case 403: return 'You do not have permission to perform this action in this branch.';
      case 404: return 'This record or API endpoint is unavailable.';
      case 409: return 'This record has changed or is already in use. Refresh and try again.';
      case 422: case 400: return 'The server could not accept these details. Check the form and try again.';
      default: return 'The server could not complete your request. Try again.';
    }
  }
  if (error instanceof Error && error.message.startsWith('Set EXPO_PUBLIC')) return error.message;
  return 'Something went wrong. Please try again.';
}
