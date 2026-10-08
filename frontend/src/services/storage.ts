import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { LoginPortal } from './demo';
const key = 'branchsuite.access-token';
const portalKey = 'branchsuite.login-portal';
export async function readLoginPortal(): Promise<LoginPortal> {
  const value = Platform.OS === 'web' ? (typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(portalKey)) : await SecureStore.getItemAsync(portalKey);
  return value === 'employee' ? 'employee' : 'staff';
}
export async function writeLoginPortal(portal: LoginPortal) {
  if (Platform.OS === 'web') { if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(portalKey, portal); }
  else await SecureStore.setItemAsync(portalKey, portal);
}
export async function readToken(): Promise<string | null> {
  if (Platform.OS === 'web') return typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(key);
  return SecureStore.getItemAsync(key);
}
export async function writeToken(token: string | null) {
  if (Platform.OS === 'web') {
    if (typeof sessionStorage !== 'undefined') {
      if (token) sessionStorage.setItem(key, token); else { sessionStorage.removeItem(key); sessionStorage.removeItem(portalKey); }
    }
    return;
  }
  if (token) await SecureStore.setItemAsync(key, token); else { await SecureStore.deleteItemAsync(key); await SecureStore.deleteItemAsync(portalKey); }
}
