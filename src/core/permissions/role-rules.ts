import type { Role } from '../auth/auth.types';
export const modules = ['dashboard','customers','support','plans','billing','marketing','offers','settings','audit'] as const;
export type Module = typeof modules[number];
export const roleRules: Record<Role, readonly Module[]> = { 'Platform Admin': modules, 'Platform Support': ['dashboard','customers','support'] };
