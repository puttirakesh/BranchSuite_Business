// Web sessions are limited to the current tab; mobile uses SecureStore.
export async function readSession(key: string): Promise<string | null> {
  return typeof window === 'undefined' ? null : window.sessionStorage.getItem(key);
}
export async function writeSession(key: string, value: string): Promise<void> {
  window.sessionStorage.setItem(key, value);
}
export async function deleteSession(key: string): Promise<void> {
  window.sessionStorage.removeItem(key);
}
