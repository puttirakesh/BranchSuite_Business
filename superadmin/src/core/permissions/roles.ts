export type PlatformRole = 'PLATFORM_ADMIN' | 'PLATFORM_SUPPORT';

export function isPlatformRole(value: unknown): value is PlatformRole {
  return value === 'PLATFORM_ADMIN' || value === 'PLATFORM_SUPPORT';
}

export function homeForRole(role: PlatformRole) {
  return role === 'PLATFORM_ADMIN' ? '/(admin)/dashboard' : '/(support)/dashboard';
}
