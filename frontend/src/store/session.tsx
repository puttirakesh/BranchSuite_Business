import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import axios from 'axios';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api, configureSession, errorMessage } from '../services/api';
import { readLoginPortal, readToken, writeLoginPortal, writeToken } from '../services/storage';
import { loginSchema, sessionSchema, type Membership, type Permission, type Scope, type Session } from '../types';
import { InputValidationError, validateLogin } from '../utils/validation';
import { createDemoSession, demoEnabled, findDemoAccount, stopDemo, type LoginPortal } from '../services/demo';

interface SessionState {
  session: Session | null; loading: boolean; error: string | null; notice: string | null; scope: Scope | null; membership: Membership | undefined;
  portal: LoginPortal; isDemo: boolean;
  login: (email: string, password: string, portal?: LoginPortal, demoTenantId?: string) => Promise<void>;
  openDemo: (tenantId: string, accountId: string, portal: LoginPortal) => Promise<void>; logout: () => Promise<void>; retry: () => void;
  selectBranch: (membershipId: string, branchId: string) => void; can: (permission: Permission) => boolean;
}
const SessionContext = createContext<SessionState | null>(null);
export function SessionProvider({ children }: PropsWithChildren) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30000, networkMode: 'always' }, mutations: { networkMode: 'always', retry: false } } }));
  const [session, setSession] = useState<Session | null>(null);
  const [scope, setScope] = useState<Scope | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [portal, setPortal] = useState<LoginPortal>('staff');
  const [isDemo, setIsDemo] = useState(false);
  function acceptSession(value: Session, selectedPortal: LoginPortal = value.memberships.length > 0 && value.memberships.every((m) => m.role.toUpperCase() === 'EMPLOYEE') ? 'employee' : 'staff') {
    const memberships = value.memberships.filter((m) => (m.role.toUpperCase() === 'EMPLOYEE') === (selectedPortal === 'employee'));
    if (!memberships.length && (value.memberships.length || selectedPortal === 'employee')) throw new InputValidationError({ portal: `This account has no ${selectedPortal === 'employee' ? 'employee' : 'business and staff'} membership.` });
    setSession({ ...value, memberships }); setPortal(selectedPortal);
    const first = memberships.find((m) => m.branches.length > 0);
    setScope(first ? { membershipId: first.id, tenantId: first.tenantId, companyId: first.companyId, branchId: first.branches[0].id } : null);
  }
  async function clearSession(message: string | null = null) {
    stopDemo(); setIsDemo(false);
    configureSession(null); setSession(null); setScope(null); setNotice(message);
    await client.cancelQueries(); client.clear();
    try { await writeToken(null); } catch { setNotice('Signed out. Secure storage could not be cleared; close the app before using a shared device.'); }
  }
  function configure(token: string) { configureSession(token, () => { void clearSession('Your session expired. Please sign in again.'); }); }
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    async function restore() {
      setLoading(true); setError(null);
      try {
        const token = await readToken();
        if (!active || !token) return;
        configure(token);
        const response = await api.get('/auth/me', { signal: controller.signal });
        const restoredPortal = await readLoginPortal();
        if (active) acceptSession(sessionSchema.parse(response.data), restoredPortal);
      } catch (err) {
        if (!active) return;
        if (axios.isAxiosError(err) && err.response?.status === 401) await clearSession('Your session expired. Please sign in again.');
        else { configureSession(null); setError(errorMessage(err)); }
      } finally { if (active) setLoading(false); }
    }
    void restore();
    return () => { active = false; controller.abort(); };
  }, [attempt]);
  async function openDemo(tenantId: string, accountId: string, selectedPortal: LoginPortal) {
    await client.cancelQueries(); client.clear();
    const value = createDemoSession(tenantId, accountId, selectedPortal);
    configureSession(null); setIsDemo(true); acceptSession(value, selectedPortal); setNotice(null);
  }
  async function login(email: string, password: string, selectedPortal: LoginPortal = 'staff', demoTenantId?: string) {
    const credentials = validateLogin(email, password);
    if (!credentials.input) throw new InputValidationError(credentials.errors);
    if (demoTenantId && email.trim().toLowerCase().endsWith('@demo.example')) {
      const account = findDemoAccount(email, password, demoTenantId, selectedPortal);
      await openDemo(demoTenantId, account.id, selectedPortal); return;
    }
    stopDemo(); setIsDemo(false);
    const response = loginSchema.parse((await api.post('/auth/login', { ...credentials.input, portal: selectedPortal })).data);
    if ((response.session.memberships.length || selectedPortal === 'employee') && !response.session.memberships.some((m) => (m.role.toUpperCase() === 'EMPLOYEE') === (selectedPortal === 'employee'))) throw new InputValidationError({ portal: 'This account does not have access to the selected login type.' });
    await writeLoginPortal(selectedPortal); await writeToken(response.accessToken);
    await client.cancelQueries(); client.clear();
    configure(response.accessToken); acceptSession(response.session, selectedPortal); setNotice(null);
  }
  async function logout() {
    try { if (!demoEnabled()) await api.post('/auth/logout'); } catch { /* Local logout works offline too. */ }
    finally { await clearSession(); }
  }
  const membership = session?.memberships.find((m) => m.id === scope?.membershipId);
  function selectBranch(membershipId: string, branchId: string) {
    const selected = session?.memberships.find((m) => m.id === membershipId && m.branches.some((b) => b.id === branchId));
    if (!selected) return;
    void client.cancelQueries(); client.clear();
    setScope({ membershipId, tenantId: selected.tenantId, companyId: selected.companyId, branchId });
  }
  return <QueryClientProvider client={client}><SessionContext.Provider value={{ session, scope, membership, loading, error, notice, login, logout, portal, isDemo, openDemo,
    retry: () => setAttempt((n) => n + 1), selectBranch,
    // This controls visibility only. The backend must authorize every scoped action.
    can: (permission) => membership?.permissions.includes(permission) ?? false,
  }}>{children}</SessionContext.Provider></QueryClientProvider>;
}
export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('SessionProvider is required.');
  return value;
}
