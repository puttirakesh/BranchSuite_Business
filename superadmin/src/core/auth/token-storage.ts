
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'branchsuite_platform_access_token';

export async function saveToken(token: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(TOKEN_KEY, token);
    }
    return;
  }

  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return typeof sessionStorage !== 'undefined'
      ? sessionStorage.getItem(TOKEN_KEY)
      : null;
  }

  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function deleteToken(): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(TOKEN_KEY);
    }
    return;
  }

  await SecureStore.deleteItemAsync(TOKEN_KEY);
}
