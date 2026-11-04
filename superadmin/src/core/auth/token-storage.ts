import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { SessionUser } from './auth.types';

const KEY = 'branchsuite.superadmin.session';

export interface StoredSession {
  token: string;
  user: SessionUser;
}

/**
 * Native: Keychain / Keystore via expo-secure-store.
 * Web: sessionStorage, so the token is dropped when the tab closes. Move to an
 * httpOnly cookie once the backend supports it (see docs/API_INTEGRATION.md).
 */
const webStore = {
  get: () => {
    try {
      return globalThis.sessionStorage?.getItem(KEY) ?? null;
    } catch {
      return null;
    }
  },
  set: (value: string) => {
    try {
      globalThis.sessionStorage?.setItem(KEY, value);
    } catch {
      /* Private browsing can block storage; the session then lasts for this page only. */
    }
  },
  clear: () => {
    try {
      globalThis.sessionStorage?.removeItem(KEY);
    } catch {
      /* nothing stored */
    }
  },
};

export async function readSession(): Promise<StoredSession | null> {
  const raw = Platform.OS === 'web' ? webStore.get() : await SecureStore.getItemAsync(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

export async function writeSession(session: StoredSession) {
  const raw = JSON.stringify(session);
  if (Platform.OS === 'web') webStore.set(raw);
  else await SecureStore.setItemAsync(KEY, raw);
}

export async function clearSession() {
  if (Platform.OS === 'web') webStore.clear();
  else await SecureStore.deleteItemAsync(KEY);
}
