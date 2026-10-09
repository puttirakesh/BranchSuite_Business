import AsyncStorage from '@react-native-async-storage/async-storage';

export type PayrollRecord = { employeeId: string; period: string; gross: number; deductions: number; branch?: string; employeeName?: string; incentives?: number };
const key = 'branchsuite:payroll:v1';
let pendingWrite: Promise<void> = Promise.resolve();
export async function readPayroll(): Promise<PayrollRecord[]> {
  const stored = await AsyncStorage.getItem(key);
  const records: unknown = stored === null ? [] : JSON.parse(stored);
  if (!Array.isArray(records) || !records.every(item => item && typeof item.employeeId === 'string' && typeof item.period === 'string' && Number.isFinite(item.gross) && Number.isFinite(item.deductions) && (item.incentives === undefined || Number.isFinite(item.incentives)))) throw new Error('Payroll records could not be read.');
  return records;
}
export function savePayroll(record: PayrollRecord): Promise<PayrollRecord[]> {
  const operation = pendingWrite.then(async () => {
    if (!record.employeeId || !record.branch || !/^\d{4}-(0[1-9]|1[0-2])$/.test(record.period) || !Number.isFinite(record.gross) || !Number.isFinite(record.deductions) || !Number.isFinite(record.incentives || 0) || record.gross < 0 || record.deductions < 0 || record.deductions > record.gross || (record.incentives || 0) < 0 || (record.incentives || 0) > record.gross) throw new Error('Enter valid amounts. Deductions and incentives cannot exceed gross earnings.');
    const runs = JSON.parse(await AsyncStorage.getItem('branchsuite:payroll-runs:v1') || '[]');
    if (!Array.isArray(runs)) throw new Error('Payroll runs could not be read.');
    if (runs.some(run => run.branch === record.branch && run.period === record.period && run.status === 'submitted')) throw new Error('This payroll run has already been submitted.');
    const records = await readPayroll();
    const index = records.findIndex(item => item.employeeId === record.employeeId && item.period === record.period);
    if (index < 0) records.push(record); else records[index] = { ...records[index], ...record };
    await AsyncStorage.setItem(key, JSON.stringify(records));
    return records;
  });
  pendingWrite = operation.then(() => undefined, () => undefined);
  return operation;
}
