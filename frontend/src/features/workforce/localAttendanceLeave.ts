import AsyncStorage from '@react-native-async-storage/async-storage';
import { isDate, validate } from './validation';
import { resources } from './resources';
import { WorkforceRecord } from './types';

export type AttendanceLeaveModule = 'attendance' | 'leave';
const pending = new Map<AttendanceLeaveModule, Promise<unknown>>();
const key = (resource: AttendanceLeaveModule) => `branchsuite.local.${resource}.v1`;
export async function readLocalAttendanceLeave(resource: AttendanceLeaveModule): Promise<WorkforceRecord[]> {
  const raw = await AsyncStorage.getItem(key(resource));
  if (!raw) return [];
  const records: unknown = JSON.parse(raw);
  if (!Array.isArray(records) || !records.every(record => record && typeof record.id === 'string' && typeof record.employeeId === 'string' && typeof record.employeeName === 'string'
    && Object.values(record).every(value => value === null || ['string', 'number', 'boolean'].includes(typeof value)))) throw new Error('Saved records could not be read.');
  return records;
}
export function saveLocalAttendanceLeave(resource: AttendanceLeaveModule, record: WorkforceRecord): Promise<WorkforceRecord[]> {
  const write = (pending.get(resource) ?? Promise.resolve()).catch(() => undefined).then(async () => {
    const records = await readLocalAttendanceLeave(resource);
    if (resource === 'attendance' && records.some(item => item.id !== record.id && item.employeeId === record.employeeId && item.date === record.date)) throw new Error('Attendance is already recorded for this employee on this date. Open that record to edit it.');
    const next = [record, ...records.filter(item => item.id !== record.id)];
    await AsyncStorage.setItem(key(resource), JSON.stringify(next));
    return next;
  });
  pending.set(resource, write);
  return write;
}
export function validateAttendance(values: Record<string, string>): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!values.employeeId) errors.employeeId = 'Choose an employee.';
  if (!isDate(values.date ?? '')) errors.date = 'Choose a valid work date.';
  const time = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!time.test(values.checkIn ?? '')) errors.checkIn = 'Enter check-in time in HH:mm format.';
  if (values.checkOut && !time.test(values.checkOut)) errors.checkOut = 'Enter check-out time in HH:mm format.';
  if (values.checkOut && !errors.checkIn && !errors.checkOut && values.checkOut <= values.checkIn) errors.checkOut = 'Check-out must be after check-in.';
  if ((values.notes ?? '').length > 2000) errors.notes = 'Use no more than 2,000 characters.';
  return errors;
}
export function validateLeave(values: Record<string, string>): Record<string, string> {
  return validate(resources.leave.fields, values);
}
export function workedMinutes(checkIn: string, checkOut: string): number | null {
  if (!checkOut) return null;
  const minutes = (time: string) => { const [hours, remainder] = time.split(':').map(Number); return hours * 60 + remainder; };
  return minutes(checkOut) - minutes(checkIn);
}
export function leaveDays(startDate: string, endDate: string): number {
  return Math.round((Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86400000) + 1;
}
