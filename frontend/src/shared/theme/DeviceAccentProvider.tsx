import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '../../core/admin/storage';
import { useAuth } from '../../core/auth/AuthProvider';

export const deviceAccents = [
  { label: 'Cobalt + soft blue', color: '#345cf2', soft: '#eaf0ff' },
  { label: 'Teal + soft mint', color: '#008578', soft: '#dff5ef' },
  { label: 'Violet + soft lavender', color: '#7853c8', soft: '#eee7ff' },
] as const;

const storageKey = 'branchsuite:workspace-accent:v2';
const legacyStorageKey = 'branchsuite:workspace-settings:v1';

type DeviceAccentContextValue = {
  accent: number;
  palette: (typeof deviceAccents)[number];
  loadError: string;
  setAccent: (value: number) => void;
  saveAccent: (value: number) => Promise<void>;
};

const defaultValue: DeviceAccentContextValue = {
  accent: 0,
  palette: deviceAccents[0],
  loadError: '',
  setAccent: () => undefined,
  saveAccent: async () => undefined,
};

const DeviceAccentContext = createContext(defaultValue);

function validAccent(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < deviceAccents.length;
}

export function DeviceAccentProvider({ children }: { children: React.ReactNode }) {
  const { loading: authLoading, isAuthenticated } = useAuth();
  const [accent, setAccentState] = useState(0);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (authLoading) return;
    let active = true;
    const load = async () => {
      try {
        const saved = await AsyncStorage.getItem(storageKey);
        if (saved !== null) {
          const candidate = Number(saved);
          if (active && validAccent(candidate)) setAccentState(candidate);
          return;
        }
        if (isAuthenticated) {
          const legacy = await AsyncStorage.getItem(legacyStorageKey);
          if (legacy) {
            try {
              const parsed: unknown = JSON.parse(legacy);
              const candidate = parsed && typeof parsed === 'object' && 'accent' in parsed
                ? (parsed as { accent: unknown }).accent
                : 0;
              if (active && validAccent(candidate)) setAccentState(candidate);
            } catch {
              // Invalid legacy settings are ignored; new device settings use the default accent.
            }
          }
        }
      } catch (cause) {
        if (active) setLoadError(cause instanceof Error ? cause.message : 'Could not load the device accent.');
      }
    };
    void load();
    return () => { active = false; };
  }, [authLoading, isAuthenticated]);

  const setAccent = useCallback((value: number) => {
    if (!validAccent(value)) throw new RangeError('Choose an available device accent.');
    setAccentState(value);
    setLoadError('');
  }, []);

  const saveAccent = useCallback(async (value: number) => {
    if (!validAccent(value)) throw new RangeError('Choose an available device accent.');
    await AsyncStorage.setItem(storageKey, String(value));
    setAccentState(value);
    setLoadError('');
  }, []);

  const value = useMemo(() => ({
    accent,
    palette: deviceAccents[accent],
    loadError,
    setAccent,
    saveAccent,
  }), [accent, loadError, saveAccent, setAccent]);

  return <DeviceAccentContext.Provider value={value}>{children}</DeviceAccentContext.Provider>;
}

export function useDeviceAccent() {
  return useContext(DeviceAccentContext);
}
