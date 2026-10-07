import { z } from 'zod';
import { api, scopeHeaders } from './api';
import type { Scope } from '../types';

const date = z.iso.date();
const timestamp = z.iso.datetime({ offset: true });
export const employeeDashboardSchema = z.object({
  date,
  profile: z.object({ employeeId: z.string(), designation: z.string(), department: z.string(), manager: z.string().nullable(), joinedOn: date.nullable() }),
  attendance: z.object({ status: z.enum(['NOT_CHECKED_IN', 'CHECKED_IN', 'CHECKED_OUT', 'ON_LEAVE', 'HOLIDAY']), shift: z.string().nullable(), checkedInAt: timestamp.nullable(), checkedOutAt: timestamp.nullable() }),
  leave: z.object({ casual: z.number().nonnegative(), sick: z.number().nonnegative(), pendingRequests: z.number().int().nonnegative() }),
  tasks: z.array(z.object({ id: z.string(), title: z.string(), status: z.enum(['TODO', 'IN_PROGRESS', 'COMPLETED']), dueAt: timestamp.nullable() })),
  latestPayslip: z.object({ id: z.string(), period: z.string(), netPay: z.number().nonnegative(), currency: z.string().length(3), status: z.enum(['PUBLISHED', 'PAID']) }).nullable(),
});
export type EmployeeDashboard = z.infer<typeof employeeDashboardSchema>;
export async function getEmployeeDashboard(scope: Scope, signal?: AbortSignal) {
  return employeeDashboardSchema.parse((await api.get('/employee/dashboard', { headers: scopeHeaders(scope), signal })).data);
}
export async function recordAttendance(scope: Scope, action: 'check-in' | 'check-out') {
  await api.post(`/employee/attendance/${action}`, {}, { headers: scopeHeaders(scope) });
}
