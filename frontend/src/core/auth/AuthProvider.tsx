
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import axios from "axios";

import {
  api,
  AuthSession,
  LoginPortal,
  getSessionApi,
  loginApi,
  logoutApi,
  setAccessToken,
  subscribeSessionExpiry,
} from "../api/client";
import { resetAdminWorkspace } from '../admin/scope';
import { toast } from '../../ui/toast-store';

const TOKEN_KEY = "branchsuite_access_token";

interface AuthContextType {
  session: AuthSession | null;
  loading: boolean;
  isAuthenticated: boolean;

  signIn: (
    email: string,
    password: string,
    portal: LoginPortal
  ) => Promise<AuthSession>;

  signOut: () => Promise<void>;
}

const AuthContext =
  createContext<AuthContextType | undefined>(undefined);


async function saveToken(token: string) {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(TOKEN_KEY, token);
    }
    return;
  }

  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

async function readToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    if (typeof window === "undefined") {
      return null;
    }

    return window.sessionStorage.getItem(TOKEN_KEY);
  }

  return SecureStore.getItemAsync(TOKEN_KEY);
}

async function removeToken() {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(TOKEN_KEY);
    }
    return;
  }

  await SecureStore.deleteItemAsync(TOKEN_KEY);
}


export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, setSession] =
    useState<AuthSession | null>(null);

  const [loading, setLoading] = useState(true);
  const restoreController = useRef<AbortController | null>(null);

  useEffect(() => subscribeSessionExpiry(() => {
    restoreController.current?.abort();
    setLoading(false);
    toast.error('Your session has expired. Please sign in again.');
    setAccessToken(null); setSession(null); resetAdminWorkspace();
    void removeToken().catch(() => undefined);
  }), []);

  // Restore authentication when the app starts.
  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();
    restoreController.current = controller;

    async function restoreAuth() {
      try {
        const savedToken = await readToken();

        if (!savedToken || !mounted || controller.signal.aborted) return;

        setAccessToken(savedToken);

        const currentSession = await getSessionApi(controller.signal);
        if (!mounted || controller.signal.aborted) return;

        if (
          !currentSession.memberships?.some(
            (membership) => membership.branches.length > 0
          )
        ) {
          throw new Error("No active business access.");
        }

        if (mounted) {
          setSession(currentSession);
        }
      } catch (error) {
        if (!mounted || controller.signal.aborted) return;
        // An unauthorized response means the saved token
        // is invalid or expired.
        const unauthorized =
          axios.isAxiosError(error) &&
          (error.response?.status === 401 ||
            error.response?.status === 403);

        const invalidSession =
          error instanceof Error &&
          error.message === "No active business access.";

        if (unauthorized || invalidSession) {
          setAccessToken(null);
          await removeToken().catch(() => undefined);
        } else {
          // For a temporary network failure, keep the
          // saved token so the user can retry later.
          setAccessToken(null);
        }

        if (mounted) {
          setSession(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void restoreAuth();

    return () => {
      mounted = false;
      controller.abort();
    };
  }, []);

  const signIn = useCallback(
    async (
      email: string,
      password: string,
      portal: LoginPortal
    ): Promise<AuthSession> => {
      restoreController.current?.abort();
      const result = await loginApi(
        email,
        password,
        portal
      );

      if (
        !result.accessToken ||
        !result.session?.user
      ) {
        throw new Error(
          "Invalid response from authentication server."
        );
      }

      const authorizedMemberships =
        result.session.memberships?.filter(
          (membership) =>
            membership.branches.length > 0
        ) ?? [];

      if (!authorizedMemberships.length) {
        throw new Error(
          "No active company or branch access assigned."
        );
      }

      // Store the token only after checking the login
      // response and the user's business access.
      await saveToken(result.accessToken);

      setAccessToken(result.accessToken);
      resetAdminWorkspace();
      setSession(result.session);

      return result.session;
    },
    []
  );

  const signOut = useCallback(async () => {
    const authorization = api.defaults.headers.common.Authorization;
    restoreController.current?.abort();
    // Clear local auth before notifying workspace subscribers or waiting on the server.
    setAccessToken(null);
    setSession(null);
    setLoading(false);
    const removedToken = removeToken().catch(() => undefined);
    resetAdminWorkspace();
    try {
      if (typeof authorization === 'string' && authorization) await logoutApi(authorization);
    } catch {
      // Local logout still succeeds offline or when this token was already revoked.
    } finally {
      await removedToken;
      toast.info('You have been signed out.');
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        loading,
        isAuthenticated: session !== null,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider."
    );
  }

  return context;
}
