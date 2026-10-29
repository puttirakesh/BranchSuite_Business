import { createContext, useContext } from 'react';
import type { Account } from './auth.types';
export const AuthContext = createContext<{ account: Account | null; ready: boolean }>({ account: null, ready: false });
export const useAuth = () => useContext(AuthContext);
