import type { Field } from './types';

export const employeeSteps = [
  { title: 'Profile', heading: 'Who is joining your team?', keys: ['name', 'email', 'phone'] },
  { title: 'Employment', heading: 'Their place in your business', keys: ['jobTitle', 'department', 'startDate', 'status'] },
  { title: 'Review', heading: 'Review employee details', keys: [] },
] as const;

export function employeeStepFields(fields: Field[], step: number): Field[] {
  const keys: readonly string[] = employeeSteps[step]?.keys ?? [];
  return fields.filter(field => keys.includes(field.key));
}
export function employeeErrorStep(errors: Record<string, string>): number {
  return employeeSteps.findIndex(step => step.keys.some(key => !!errors[key]));
}
export function employeeInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length ? [parts[0], ...(parts.length > 1 ? [parts[parts.length - 1]] : [])]
    .map(part => Array.from(part)[0]).join('').toLocaleUpperCase() : '?';
}
