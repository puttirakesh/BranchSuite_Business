import { entityKinds, type CrmRecord, type EntityKind, type RecordInput, type Scope, type Session } from '../types';
import { quoteTotals } from '../utils/crm';
import { InputValidationError } from '../utils/validation';

export type LoginPortal = 'staff' | 'employee';
export const demoBusinesses = [
  { id: 't1', name: '5 Gen Educon', industry: 'Education', status: 'Active', branches: ['Vijayawada', 'Guntur', 'Hyderabad'] },
  { id: 't2', name: 'Northstar Services', industry: 'Professional services', status: 'Trial', branches: ['Hyderabad'] },
  { id: 't3', name: 'BrightPath Labs', industry: 'Technology', status: 'Past due', branches: ['Bengaluru'] },
];
export const demoAccounts = [
  { id: 'admin', tenantId: 't1', name: 'Neha Iyer', role: 'BUSINESS_ADMIN', label: 'Business Admin', email: 'admin@demo.example' },
  { id: 'manager', tenantId: 't1', name: 'Kavitha Reddy', role: 'MANAGER', label: 'Manager', email: 'manager@demo.example' },
  { id: 'sales', tenantId: 't1', name: 'Ravi Teja', role: 'SALES', label: 'Sales', email: 'sales@demo.example' },
  { id: 'branch-manager', tenantId: 't1', name: 'Kabir Shah', role: 'MANAGER', label: 'Branch Manager', email: 'branch@demo.example' },
  { id: 'hr', tenantId: 't1', name: 'Meera Reddy', role: 'HR', label: 'HR Manager', email: 'hr@demo.example' },
  { id: 'payroll', tenantId: 't1', name: 'Payroll Officer', role: 'PAYROLL', label: 'Payroll Officer', email: 'payroll@demo.example' },
  { id: 'employee', tenantId: 't1', name: 'Ananya Rao', role: 'EMPLOYEE', label: 'Employee', email: 'employee@demo.example' },
  { id: 'northstar-admin', tenantId: 't2', name: 'Priya Mehta', role: 'BUSINESS_ADMIN', label: 'Business Admin', email: 'northstar@demo.example' },
  { id: 'northstar-employee', tenantId: 't2', name: 'Northstar Employee', role: 'EMPLOYEE', label: 'Employee', email: 'northstar.employee@demo.example' },
  { id: 'brightpath-admin', tenantId: 't3', name: 'Dev Menon', role: 'BUSINESS_ADMIN', label: 'Business Admin', email: 'brightpath@demo.example' },
  { id: 'brightpath-employee', tenantId: 't3', name: 'BrightPath Employee', role: 'EMPLOYEE', label: 'Employee', email: 'brightpath.employee@demo.example' },
];
let active: Session | null = null;
let sequence = 0;
const records = new Map<string, CrmRecord[]>();
export const demoEnabled = () => active !== null;
export function stopDemo() { active = null; }
export function createDemoSession(tenantId: string, accountId: string, portal: LoginPortal): Session {
  const business = demoBusinesses.find((b) => b.id === tenantId);
  const account = demoAccounts.find((a) => a.id === accountId && a.tenantId === tenantId && (a.role === 'EMPLOYEE') === (portal === 'employee'));
  if (!business || !account) throw new InputValidationError({ account: 'Choose an account from the selected business and login type.' });
  active = { user: { id: account.id, name: account.name, email: account.email }, memberships: [{
    id: `demo-${account.id}`, tenantId, companyId: `demo-company-${tenantId}`, companyName: business.name, role: account.role,
    permissions: portal === 'employee' || ['HR', 'PAYROLL'].includes(account.role) ? [] : ['dashboard:read', ...entityKinds.flatMap((kind) => ['read', 'create', 'update', 'delete'].map((action) => `${kind}:${action}`))],
    branches: business.branches.map((name, i) => ({ id: `${tenantId}-branch-${i}`, name })).filter((b) =>
      account.id === 'branch-manager' ? b.name === 'Guntur' : account.role === 'SALES' ? b.name === business.branches[0] : account.role === 'EMPLOYEE' ? b.name === business.branches[0] : true),
  }] };
  return active;
}
export function findDemoAccount(email: string, password: string, tenantId: string, portal: LoginPortal) {
  const account = demoAccounts.find((a) => a.email.toLowerCase() === email.trim().toLowerCase() && a.tenantId === tenantId && (a.role === 'EMPLOYEE') === (portal === 'employee'));
  if (!account || password !== 'Demo123') throw new InputValidationError({ credentials: 'Choose a matching demo account and use Demo123.' });
  return account;
}
function bucket(scope: Scope, kind: EntityKind, action = 'read') {
  const membership = active?.memberships.find((m) => m.id === scope.membershipId && m.tenantId === scope.tenantId && m.companyId === scope.companyId && m.branches.some((b) => b.id === scope.branchId));
  if (!membership?.permissions.includes(`${kind}:${action}`)) throw new InputValidationError({ scope: 'This demo account cannot access this branch or action.' });
  const key = `${scope.tenantId}:${scope.companyId}:${scope.branchId}:${kind}`;
  if (!records.has(key)) {
    const common = { id: `${scope.branchId}-${kind}-sample`, createdAt: '2026-10-07T08:00:00Z' };
    records.set(key, kind === 'leads' ? [{ ...common, name: 'Sunrise Academy', status: 'NEW', email: 'hello@sunrise.example', organization: 'Sunrise Academy', source: 'Referral' }] : []);
  }
  return records.get(key)!;
}
export function demoList(scope: Scope, kind: EntityKind, search: string, status: string, cursor?: string) {
  const filtered = bucket(scope, kind).filter((r) => r.name.toLowerCase().includes(search.toLowerCase()) && (!status || r.status === status));
  const offset = Number(cursor) || 0;
  return { items: filtered.slice(offset, offset + 25), nextCursor: offset + 25 < filtered.length ? String(offset + 25) : null };
}
export function demoRecord(scope: Scope, kind: EntityKind, id: string) {
  const record = bucket(scope, kind).find((r) => r.id === id);
  if (!record) throw new InputValidationError({ record: 'This demo record is unavailable in this branch.' });
  return record;
}
export function demoSave(scope: Scope, kind: EntityKind, input: RecordInput, id?: string) {
  const rows = bucket(scope, kind, id ? 'update' : 'create');
  const previous = id ? demoRecord(scope, kind, id) : undefined;
  if (input.customerId) demoRecord(scope, 'customers', input.customerId);
  if (input.contactId) demoRecord(scope, 'contacts', input.contactId);
  const record: CrmRecord = { ...previous, ...input, id: id ?? `demo-${++sequence}`, createdAt: previous?.createdAt ?? new Date().toISOString(),
    ...(kind === 'quotes' ? { total: quoteTotals(input.items ?? [], input.taxRate ?? 0).total } : {}) };
  if (previous) rows.splice(rows.indexOf(previous), 1, record); else rows.unshift(record);
  return record;
}
export function demoDelete(scope: Scope, kind: EntityKind, id: string) {
  const rows = bucket(scope, kind, 'delete'); const record = demoRecord(scope, kind, id); rows.splice(rows.indexOf(record), 1);
}
export function demoDashboard(scope: Scope) {
  const deals = bucket(scope, 'deals').filter((r) => !['WON', 'LOST'].includes(r.status));
  return { leads: bucket(scope, 'leads').length, customers: bucket(scope, 'customers').length, openDeals: deals.length,
    pipelineValue: deals.filter((r) => r.currency === 'INR').reduce((sum, r) => sum + (r.amount ?? 0), 0), currency: 'INR',
    quotesAwaitingResponse: bucket(scope, 'quotes').filter((r) => r.status === 'SENT').length, recentActivity: [] };
}
