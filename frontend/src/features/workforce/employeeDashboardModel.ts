import type { EmployeeSummary, WorkforceRecord } from './types';

export function summarizeEmployees(employees: WorkforceRecord[]): EmployeeSummary {
  const departments = new Map<string, number>();
  for (const employee of employees) {
    const name = String(employee.department || 'Unassigned');
    departments.set(name, (departments.get(name) ?? 0) + 1);
  }
  return { total: employees.length, active: employees.filter(employee => employee.status === 'ACTIVE').length,
    inactive: employees.filter(employee => employee.status === 'INACTIVE').length,
    departments: [...departments].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)) };
}
