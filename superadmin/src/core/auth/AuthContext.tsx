import axios from 'axios';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { onSessionExpired, setAccessToken } from '../api/client';
import { getApiErrorMessage } from '../api/api-error';
import { getProfile, InvalidSessionError, signIn, signOut } from './auth.service';
import type { PlatformUser } from './auth.types';
import { deleteToken, getToken, saveToken } from './token-storage';

interface AuthContextValue {
  user: PlatformUser | null;
  loading: boolean;
  sessionError: string | null;
  restoreSession: () => Promise<void>;
  login: (email: string, password: string) => Promise<PlatformUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PlatformUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  // An older restore/request must never replace a newer login or logout.
  const revision = useRef(0);

  const restoreSession = useCallback(async () => {
    const current = ++revision.current;
    setLoading(true);
    setSessionError(null);
    try {
      const token = await getToken();
      const account = token ? await getProfile(token) : null;
      if (current !== revision.current) return;
      setAccessToken(token);
      setUser(account);
    } catch (error) {
      if (current !== revision.current) return;
      setAccessToken(null);
      setUser(null);
      if (error instanceof InvalidSessionError || (axios.isAxiosError(error) && [401, 403].includes(error.response?.status ?? 0))) {
        try { await deleteToken(); }
        catch (storageError) { if (current === revision.current) setSessionError(getApiErrorMessage(storageError)); }
      } else {
        // Keep the saved token when connectivity fails so restoration can be retried.
        setSessionError(getApiErrorMessage(error, 'Unable to restore your session.'));
      }
    } finally {
      if (current === revision.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onSessionExpired(() => {
      const current = ++revision.current;
      setUser(null);
      setLoading(false);
      void deleteToken().catch((error: unknown) => {
        if (current === revision.current) setSessionError(getApiErrorMessage(error));
      });
    });
    void restoreSession();
    return () => { revision.current++; unsubscribe(); setAccessToken(null); };
  }, [restoreSession]);

  const login = useCallback(async (email: string, password: string) => {
    const current = ++revision.current;
    const response = await signIn(email, password);
    if (current !== revision.current) throw new Error('Sign-in was cancelled. Please try again.');
    await saveToken(response.accessToken);
    if (current !== revision.current) throw new Error('Sign-in was cancelled. Please try again.');
    setAccessToken(response.accessToken);
    setSessionError(null);
    setUser(response.user);
    return response.user;
  }, []);

  const logout = useCallback(async () => {
    const current = ++revision.current;
    setAccessToken(null);
    setUser(null);
    setSessionError(null);
    setLoading(true);
    try {
      try {
        const token = await getToken();
        if (token) await signOut(token);
      } finally { await deleteToken(); }
    } catch (error) {
      // Network logout failures still clear local storage. Surface storage failures.
      if (!axios.isAxiosError(error) && current === revision.current) setSessionError(getApiErrorMessage(error));
    } finally {
      if (current === revision.current) setLoading(false);
    }
  }, []);

  return <AuthContext.Provider value={{ user, loading, sessionError, restoreSession, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
