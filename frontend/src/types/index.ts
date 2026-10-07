export type UserRole =
  | 'BUSINESS_OWNER'
  | 'BUSINESS_ADMIN'
  | 'MANAGER'
  | 'SALES'
  | 'HR'
  | 'PAYROLL'
  | 'EMPLOYEE';

export interface Branch {
  id: string;
  name: string;
}
