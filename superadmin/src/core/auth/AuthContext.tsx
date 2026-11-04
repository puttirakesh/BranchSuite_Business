import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { configureHttp } from "../api/client";
import { env } from "../config/env";
import { setPreviewActor } from "../data/previewStore";
import { authService } from "./auth.service";
import { clearSession, readSession, writeSession } from "./token-storage";
import type { SessionUser } from "./auth.types";

type Status = "restoring" | "signedOut" | "signedIn";

interface AuthContextValue {
  status: Status;
  user: SessionUser | null;
  /** True when the last session ended because the server rejected the token. */
  sessionExpired: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<Status>("restoring");
  const [user, setUser] = useState<SessionUser | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const token = useRef<string | null>(null);

  const reset = useCallback(async () => {
    token.current = null;
    setUser(null);
    setStatus("signedOut");
    queryClient.clear();
    await clearSession();
  }, [queryClient]);

  useEffect(() => {
    configureHttp({
      getToken: () => token.current,
      onUnauthorized: () => {
        if (!token.current) return;
        setSessionExpired(true);
        void reset();
      },
    });
  }, [reset]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await readSession();
      if (cancelled) return;
      if (!stored || env.dataMode === "unconfigured")
        return setStatus("signedOut");
      token.current = stored.token;
      try {
        // Re-validate against the server so a revoked token is not trusted.
        const fresh =
          env.dataMode === "api" ? await authService.me() : stored.user;
        if (cancelled) return;
        setPreviewActor(fresh.name);
        setUser(fresh);
        setStatus("signedIn");
      } catch {
        if (!cancelled) await reset();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reset]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const result = await authService.login(email, password);
      token.current = result.token;
      await writeSession(result);
      queryClient.clear();
      setPreviewActor(result.user.name);
      setSessionExpired(false);
      setUser(result.user);
      setStatus("signedIn");
    },
    [queryClient],
  );

  const signOut = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      // The local session is cleared either way; the server token expires on its own.
    }
    setSessionExpired(false);
    await reset();
  }, [reset]);

  const value = useMemo(
    () => ({ status, user, sessionExpired, signIn, signOut }),
    [status, user, sessionExpired, signIn, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
