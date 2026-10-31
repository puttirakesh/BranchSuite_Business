
import axios from 'axios';

import { env } from '../config/env';

export const apiClient = axios.create({
  baseURL: env.apiUrl,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

let accessToken: string | null = null;
const expiredListeners = new Set<() => void>();

export function setAccessToken(token: string | null) {
  accessToken = token;
  if (token) apiClient.defaults.headers.common.Authorization = `Bearer ${token}`;
  else delete apiClient.defaults.headers.common.Authorization;
}

export function onSessionExpired(listener: () => void) {
  expiredListeners.add(listener);
  return () => { expiredListeners.delete(listener); };
}

apiClient.interceptors.response.use(undefined, (error: unknown) => {
  if (axios.isAxiosError(error) && error.response?.status === 401 && accessToken) {
    // A delayed response from a previous session must not expire a newer login.
    if (error.config?.headers.get('Authorization') === `Bearer ${accessToken}` && error.config?.url !== '/platform/auth/login') {
      setAccessToken(null);
      expiredListeners.forEach((listener) => listener());
    }
  }
  return Promise.reject(error);
});
