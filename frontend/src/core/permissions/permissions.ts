import { roleRules, type Module } from './role-rules';
import type { Account } from '../auth/auth.types';
export function hasPermission(account: Account | null | undefined, module: Module) { return !!account && account.active !== false && !!roleRules[account.role]?.includes(module); }
