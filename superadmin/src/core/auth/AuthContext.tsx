
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import { apiClient } from '../api/client';
import { endpoints } from '../api/endpoints';

import {
  saveToken,
  getToken,
  deleteToken,
} from './token-storage';

export type PlatformRole =
  | 'PLATFORM_ADMIN'
  | 'PLATFORM_SUPPORT';

export interface PlatformUser {
  id: string;
  name: string;
  email: string;
  role: PlatformRole;
}

interface LoginResponse {
  accessToken: string;
  user: PlatformUser;
}

interface AuthContextValue {
  user: PlatformUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<PlatformUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
);

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [user, setUser] = useState<PlatformUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function restoreSession() {
      try {
        const token = await getToken();

        if (!token) return;

        const response = await apiClient.get<PlatformUser>(
          endpoints.auth.profile,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (active) {
          setUser(response.data);
          apiClient.defaults.headers.common.Authorization =
            `Bearer ${token}`;
        }
      } catch {
        await deleteToken();

        if (active) {
          setUser(null);
          delete apiClient.defaults.headers.common.Authorization;
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    restoreSession();

    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await apiClient.post<LoginResponse>(
        endpoints.auth.login,
        { email, password },
      );

      const { accessToken, user: authenticatedUser } =
        response.data;

      if (
        !accessToken ||
        !authenticatedUser ||
        !['PLATFORM_ADMIN', 'PLATFORM_SUPPORT'].includes(
          authenticatedUser.role,
        )
      ) {
        throw new Error('Invalid platform login response');
      }

      await saveToken(accessToken);

      apiClient.defaults.headers.common.Authorization =
        `Bearer ${accessToken}`;

      setUser(authenticatedUser);

      return authenticatedUser;
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      const token = await getToken();

      if (token) {
        await apiClient.post(
          endpoints.auth.logout,
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );
      }
    } finally {
      await deleteToken();

      delete apiClient.defaults.headers.common.Authorization;

      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      'useAuth must be used inside AuthProvider',
    );
  }

  return context;
}
