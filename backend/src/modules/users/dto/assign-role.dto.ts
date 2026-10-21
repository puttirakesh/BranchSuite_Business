
import { IsIn } from 'class-validator';

export const assignableRoles = ['EMPLOYEE', 'BRANCH_MANAGER', 'SALES_MANAGER', 'HR_MANAGER', 'PAYROLL_MANAGER', 'BUSINESS_ADMIN'] as const;
export type AssignableRole = typeof assignableRoles[number];

export class AssignRoleDto {
  @IsIn(assignableRoles)
  role!: AssignableRole;
}
