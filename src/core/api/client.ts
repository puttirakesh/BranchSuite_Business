// Read-only access to the same local database used by the embedded APK.
import { readStorage } from '../auth/token-storage';
import { DATABASE_KEY } from '../config/constants';
import { ApiError } from './api-error';
import type { Database } from '../../shared/types/common.types';
export async function readDatabase(): Promise<Database | null> { try { const snapshot = await readStorage(); return snapshot[DATABASE_KEY] ? JSON.parse(snapshot[DATABASE_KEY]) : null; } catch { throw new ApiError('Unable to read saved BranchSuite data', 'STORAGE_ERROR'); } }
export async function readCollection<K extends keyof Database>(key: K): Promise<Database[K] | undefined> { return (await readDatabase())?.[key]; }
