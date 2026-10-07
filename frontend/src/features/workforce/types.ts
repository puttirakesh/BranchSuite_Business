export type Resource = 'employees' | 'tasks' | 'attendance' | 'leave' | 'payroll' | 'payslips';
export type EmployeeStatus = 'ACTIVE' | 'INACTIVE';
export interface EmployeeSummary {
  total: number; active: number; inactive: number;
  departments: { name: string; count: number }[];
}
export type RecordValue = string | number | boolean | null;
export interface WorkforceRecord {
  id: string;
  [key: string]: RecordValue;
}
export interface PageResult { items: WorkforceRecord[]; nextCursor: string | null }
export interface Scope { tenantId: string; companyId: string; branchId: string; branchName: string; companyName?: string }
export interface Session {
  accessToken: string;
  userId: string;
  scope: Scope;
  permissions: string[];
}
export interface Field {
  key: string;
  label: string;
  required?: boolean;
  kind?: 'text' | 'email' | 'phone' | 'date' | 'datetime' | 'money' | 'employee' | 'choice';
  maxLength?: number;
  hint?: string;
  options?: string[];
}
export interface Action {
  label: string;
  path: string;
  permission: string;
  allowedStatuses: string[];
  body?: Record<string, string>;
}
export interface ResourceConfig {
  title: string;
  singular: string;
  description: string;
  endpoint: string;
  permission: string;
  titleKey: string;
  fields: Field[];
  detailFields: Field[];
  createLabel?: string;
  editable?: boolean;
  actions?: Action[];
}
