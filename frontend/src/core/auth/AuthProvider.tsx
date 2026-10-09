
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import axios from "axios";

import {
  AuthSession,
  LoginPortal,
  getSessionApi,
  loginApi,
  logoutApi,
  setAccessToken,
} from "../api/client";

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
  if (Platform.OS === "web") return;

  await SecureStore.setItemAsync(
    TOKEN_KEY,
    token
  );
}

async function readToken(): Promise<string | null> {
  if (Platform.OS === "web") return null;

  return SecureStore.getItemAsync(TOKEN_KEY);
}

async function removeToken() {
  if (Platform.OS === "web") return;

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

  // Restore authentication when the app starts.
  useEffect(() => {
    let mounted = true;

    async function restoreAuth() {
      try {
        const savedToken = await readToken();

        if (!savedToken) return;

        setAccessToken(savedToken);

        const currentSession = await getSessionApi();

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
    };
  }, []);

  const signIn = useCallback(
    async (
      email: string,
      password: string,
      portal: LoginPortal
    ): Promise<AuthSession> => {
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
      setSession(result.session);

      return result.session;
    },
    []
  );

  const signOut = useCallback(async () => {
    try {
      // Current backend logout acknowledges the request
      // but does not revoke the JWT on the server.
      await logoutApi();
    } catch {
      // Local logout should still work if offline.
    } finally {
      setAccessToken(null);
      setSession(null);
      await removeToken().catch(() => undefined);
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
