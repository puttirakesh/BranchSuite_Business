import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

const key = 'branchsuite_sidebar_collapsed';
const listeners = new Set<() => void>();
let collapsed = false;
let initialized = false;
const browser = () => Platform.OS === 'web' && typeof window !== 'undefined';
function snapshot() {
  if (!browser()) return false;
  if (!initialized) {
    initialized = true;
    try { collapsed = window.localStorage.getItem(key) === 'true'; } catch { /* Storage may be disabled. */ }
  }
  return collapsed;
}
function notify() { for (const listener of listeners) listener(); }
function storageChanged(event: StorageEvent) {
  if (event.key === key || event.key === null) {
    collapsed = event.newValue === 'true'; initialized = true; notify();
  }
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (browser() && listeners.size === 1) window.addEventListener('storage', storageChanged);
  return () => {
    listeners.delete(listener);
    if (browser() && !listeners.size) window.removeEventListener('storage', storageChanged);
  };
}
function toggleSidebar() {
  if (!browser()) return;
  collapsed = !snapshot();
  try { window.localStorage.setItem(key, String(collapsed)); } catch { /* Keep this session's preference. */ }
  notify();
}

export function useSidebarPreference() {
  return { sidebarCollapsed: useSyncExternalStore(subscribe, snapshot, () => false), toggleSidebar };
}
