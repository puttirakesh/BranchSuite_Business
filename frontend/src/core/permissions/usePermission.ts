import { useAuth } from '../auth/AuthContext';
import { hasPermission } from './permissions';
import type { Module } from './role-rules';
export const usePermission = (module: Module) => hasPermission(useAuth().account, module);
