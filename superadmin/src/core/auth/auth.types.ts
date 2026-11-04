import type { Role } from '../permissions/roles';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}
