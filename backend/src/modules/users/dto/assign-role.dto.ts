
import { IsIn, IsUUID } from 'class-validator';

export const assignableRoles = ['EMPLOYEE', 'COMPANY_MANAGER', 'BRANCH_MANAGER', 'SALES_MANAGER', 'HR_MANAGER', 'PAYROLL_MANAGER', 'BUSINESS_ADMIN'] as const;
export type AssignableRole = typeof assignableRoles[number];

export class AssignRoleDto {
  @IsUUID('4')
  companyId!: string;

  @IsIn(assignableRoles)
  role!: AssignableRole;
}
