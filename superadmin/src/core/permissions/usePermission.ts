import { useAuth } from '../auth/AuthContext';
import { can, type Capability } from './roles';

export function usePermission(capability: Capability): boolean {
  const { user } = useAuth();
  return can(user?.role, capability);
}
