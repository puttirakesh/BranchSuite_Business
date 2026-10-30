import { DEMO_PASSWORD } from '../config/constants';
import { readDatabase } from '../api/client';
import type { Database } from '../../shared/types/common.types';
export function authenticateDemo(db: Database, email: string, password: string) { const account = db.accounts.find(a => a.email.toLowerCase() === email.trim().toLowerCase()); if (!account || !account.active || account.kind !== 'platform' || password !== DEMO_PASSWORD) throw Error('Check your email and password.'); return account; }
export async function currentAccount() { const db = await readDatabase(); return db?.accounts.find(a => a.id === db.session?.accountId) || null; }
