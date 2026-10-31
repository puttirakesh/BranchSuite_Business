import type { PlatformRole } from '../permissions/roles';

export interface PlatformUser {
  id: string;
  name: string;
  email: string;
  role: PlatformRole;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: 'Bearer';
  user: PlatformUser;
}
