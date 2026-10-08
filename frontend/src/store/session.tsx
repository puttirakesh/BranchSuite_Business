import {
  createContext,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { api, configureSession, errorMessage } from "../services/api";
import {
  readLoginPortal,
  readToken,
  readRefreshToken,
  writeLoginPortal,
  writeToken,
  writeRefreshToken,
  clearAuthStorage,
} from "../services/storage";
import {
  type Membership,
  type Permission,
  type Scope,
  type Session,
} from "../types";
import { InputValidationError, validateLogin } from "../utils/validation";
import {
  createDemoSession,
  demoEnabled,
  findDemoAccount,
  stopDemo,
  type LoginPortal,
} from "../services/demo";
import { currentSession, renew, signIn } from "../services/authService";

interface SessionState {
  session: Session | null;
  loading: boolean;
  error: string | null;
  notice: string | null;
  scope: Scope | null;
  membership: Membership | undefined;
  portal: LoginPortal;
  isDemo: boolean;
  login: (
    email: string,
    password: string,
    portal?: LoginPortal,
    tenantId?: string,
  ) => Promise<void>;
  openDemo: (
    tenantId: string,
    accountId: string,
    portal: LoginPortal,
  ) => Promise<void>;
  logout: () => Promise<void>;
  retry: () => void;
  selectBranch: (membershipId: string, branchId: string) => void;
  can: (permission: Permission) => boolean;
}
const SessionContext = createContext<SessionState | null>(null);
export function SessionProvider({ children }: PropsWithChildren) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, staleTime: 30000, networkMode: "always" },
          mutations: { retry: false },
        },
      }),
  );
  const [session, setSession] = useState<Session | null>(null);
  const [scope, setScope] = useState<Scope | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [portal, setPortal] = useState<LoginPortal>("staff");
  const [isDemo, setIsDemo] = useState(false);

  function acceptSession(value: Session, selectedPortal: LoginPortal) {
    // The backend already filtered memberships to the authenticated login portal.
    if (!value.memberships.length)
      throw new InputValidationError({
        portal: "No company membership is assigned to this account.",
      });
    setSession(value);
    setPortal(selectedPortal);
    const first = value.memberships.find((m) => m.branches.length > 0);
    setScope(
      first
        ? {
            membershipId: first.id,
            tenantId: first.tenantId,
            companyId: first.companyId,
            branchId: first.branches[0].id,
          }
        : null,
    );
  }
  async function clearSession(message: string | null = null) {
    stopDemo();
    setIsDemo(false);
    configureSession(null);
    setSession(null);
    setScope(null);
    setNotice(message);
    await client.cancelQueries();
    client.clear();
    try {
      await clearAuthStorage();
    } catch {
      setNotice("Signed out; secure storage could not be cleared.");
    }
  }
  function configure(token: string) {
    configureSession(token, () => {
      void clearSession("Your session expired. Please sign in again.");
    });
  }
  useEffect(() => {
    let active = true;
    async function restore() {
      setLoading(true);
      setError(null);
      try {
        const savedRefresh = await readRefreshToken();
        const savedAccess = await readToken();
        if (!active || (!savedRefresh && !savedAccess)) return;
        let value: Session;
        if (savedRefresh) {
          const updated = await renew(savedRefresh);
          if (!active) return;
          await writeToken(updated.accessToken);
          await writeRefreshToken(updated.refreshToken);
          configure(updated.accessToken);
          value = updated.session;
        } else {
          configure(savedAccess!);
          value = await currentSession();
        }
        const savedPortal = await readLoginPortal();
        if (active) acceptSession(value, savedPortal);
      } catch (err) {
        if (!active) return;
        await clearSession("Please sign in again.");
        // Network outages do not mean the password or account is invalid.
        setError(errorMessage(err));
      } finally {
        if (active) setLoading(false);
      }
    }
    void restore();
    return () => {
      active = false;
    };
  }, [attempt]);
  async function openDemo(
    tenantId: string,
    accountId: string,
    selectedPortal: LoginPortal,
  ) {
    await client.cancelQueries();
    client.clear();
    const value = createDemoSession(tenantId, accountId, selectedPortal);
    configureSession(null);
    setIsDemo(true);
    acceptSession(value, selectedPortal);
    setNotice(null);
  }
  async function login(
    email: string,
    password: string,
    selectedPortal: LoginPortal = "staff",
    tenantId?: string,
  ) {
    const credentials = validateLogin(email, password);
    if (!credentials.input) throw new InputValidationError(credentials.errors);
    if (!tenantId)
      throw new InputValidationError({
        tenant: "Select a business before signing in.",
      });
    if (
      email.trim().toLowerCase().endsWith("@demo.example") &&
      ["t1", "t2", "t3"].includes(tenantId)
    ) {
      const account = findDemoAccount(
        email,
        password,
        tenantId,
        selectedPortal,
      );
      await openDemo(tenantId, account.id, selectedPortal);
      return;
    }
    stopDemo();
    setIsDemo(false);
    const result = await signIn(
      tenantId,
      credentials.input.email,
      credentials.input.password,
      selectedPortal,
    );
    await writeLoginPortal(selectedPortal);
    await writeRefreshToken(result.refreshToken);
    await writeToken(result.accessToken);
    await client.cancelQueries();
    client.clear();
    configure(result.accessToken);
    acceptSession(result.session, selectedPortal);
    setNotice(null);
  }
  async function logout() {
    try {
      if (!demoEnabled()) await api.post("/auth/logout");
    } catch {
      /* Local logout must still complete when offline. */
    } finally {
      await clearSession();
    }
  }
  const membership = session?.memberships.find(
    (m) => m.id === scope?.membershipId,
  );
  function selectBranch(membershipId: string, branchId: string) {
    const selected = session?.memberships.find(
      (m) => m.id === membershipId && m.branches.some((b) => b.id === branchId),
    );
    if (!selected) return;
    void client.cancelQueries();
    client.clear();
    setScope({
      membershipId,
      tenantId: selected.tenantId,
      companyId: selected.companyId,
      branchId,
    });
  }
  return (
    <QueryClientProvider client={client}>
      <SessionContext.Provider
        value={{
          session,
          scope,
          membership,
          loading,
          error,
          notice,
          login,
          logout,
          portal,
          isDemo,
          openDemo,
          retry: () => setAttempt((n) => n + 1),
          selectBranch,
          can: (permission) =>
            membership?.permissions.includes(permission) ?? false,
        }}
      >
        {children}
      </SessionContext.Provider>
    </QueryClientProvider>
  );
}
export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("SessionProvider is required.");
  return value;
}
