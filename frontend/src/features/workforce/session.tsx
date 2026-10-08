import { readSession, writeSession, deleteSession } from './sessionStorage';
import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { Session } from './types';

// Frontend Dev 1 calls saveWorkforceSession after login or a branch change.
const KEY = 'branchsuite.session.v1';
const subscribers = new Set<() => void>();
export async function saveWorkforceSession(session: Session | null) {
  if (session) await writeSession(KEY, JSON.stringify(session));
  else await deleteSession(KEY);
  subscribers.forEach(listener => listener());
}
function isSession(value: unknown): value is Session {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<Session>;
  return typeof item.accessToken === 'string' && !!item.accessToken && typeof item.userId === 'string'
    && !!item.scope && ['tenantId', 'companyId', 'branchId', 'branchName'].every(key =>
      typeof (item.scope as unknown as Record<string, unknown>)[key] === 'string'
      && !!(item.scope as unknown as Record<string, unknown>)[key])
    && Array.isArray(item.permissions) && item.permissions.every(permission => typeof permission === 'string');
}
const Context = createContext<{ session: Session | null; loading: boolean; error: string | null; reload: () => void }>({
  session: null, loading: true, error: null, reload: () => {},
});
export function WorkforceSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const reload = useCallback(() => {
    const current = ++generation.current;
    // Clear old branch data immediately while the new session is read.
    setSession(null); setLoading(true); setError(null);
    readSession(KEY).then(raw => {
      if (current !== generation.current) return;
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      if (parsed && !isSession(parsed)) throw new Error('Invalid session');
      setSession(isSession(parsed) ? parsed : null);
    }).catch(() => { if (current === generation.current) setError('Your session could not be loaded. Sign in again.'); })
      .finally(() => { if (current === generation.current) setLoading(false); });
  }, []);
  useEffect(() => { reload(); subscribers.add(reload); return () => { generation.current++; subscribers.delete(reload); }; }, [reload]);
  return <Context.Provider value={{ session, loading, error, reload }}>{children}</Context.Provider>;
}
export const useWorkforceSession = () => useContext(Context);
export const can = (session: Session, permission: string) => session.permissions.includes(permission);
