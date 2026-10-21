import { getAvailableBranches } from "./admin/available-branches";

import { payrollApi, type EmployeeSalaryDto, type PayrollIncentiveDto, type PayrollPeriodDto } from './admin/api';
import { getAdminScope, resolveBranchId } from './admin/scope';
import { dateOnly, toMoney } from './admin/local';
import { assignMonthlySalary } from './admin/salary';

export type PayrollRecord = {
  employeeId: string; period: string; gross: number; deductions: number;
  branch?: string; employeeName?: string; incentives?: number;
  basicSalary?: number; houseRentAllowance?: number; specialAllowance?: number;
  /** Set when the figures come from a calculated payroll run. */
  runStatus?: 'CALCULATED' | 'APPROVED' | 'PAID' | 'DRAFT';
  entryId?: string;
  paid?: boolean;
};
export type PayrollRun = { branch: string; period: string; status: 'calculated' | 'submitted'; submittedAt: string; canApprove: boolean };

const pad = (value: number) => String(value).padStart(2, '0');
const periodKey = (year: number, month: number) => `${year}-${pad(month)}`;
export const currentPayrollMonth = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()).slice(0, 7);

type BranchPayroll = { branch: { id: string; name: string }; periods: PayrollPeriodDto[]; salaries: EmployeeSalaryDto[]; incentives: PayrollIncentiveDto[] };

async function loadBranches(): Promise<BranchPayroll[]> {
  const scope = await getAdminScope();
  const branches = await getAvailableBranches();
  return Promise.all(branches.map(async branch => {
    const [periods, salaries] = await Promise.all([
      payrollApi.periods(scope.companyId, branch.id),
      payrollApi.salaries(scope.companyId, branch.id),
    ]);
    const months = new Set([currentPayrollMonth(), ...periods.filter(period => !period.run || period.run.status === 'DRAFT').map(period => periodKey(period.year, period.month))]);
    const incentives = (await Promise.all([...months].map(month => {
      const [year, monthNumber] = month.split('-').map(Number);
      return payrollApi.incentives(scope.companyId, branch.id, year, monthNumber);
    }))).flat();
    return { branch: { id: branch.id, name: branch.name }, periods, salaries, incentives };
  }));
}

function coversMonth(salary: EmployeeSalaryDto, period: string): boolean {
  const [year, month] = period.split('-').map(Number);
  const start = `${period}-01`;
  const end = `${period}-${pad(new Date(year, month, 0).getDate())}`;
  const from = dateOnly(salary.effectiveFrom);
  const to = salary.effectiveTo ? dateOnly(salary.effectiveTo) : null;
  return from <= end && (!to || to >= start);
}

function fromAssignment(salary: EmployeeSalaryDto, branch: string, period: string, incentive = 0): PayrollRecord {
  const basic = toMoney(salary.basicOverride ?? salary.structure.basicAmount);
  const earnings = salary.structure.components.filter(item => item.kind === 'EARNING').reduce((sum, item) => sum + toMoney(item.amount), 0);
  const deductions = salary.structure.components.filter(item => item.kind === 'DEDUCTION').reduce((sum, item) => sum + toMoney(item.amount), 0);
  return {
    employeeId: salary.userId, employeeName: salary.user?.name, branch, period,
    basicSalary: basic, gross: basic + earnings, deductions, incentives: incentive,
  };
}

export async function readPayroll(): Promise<PayrollRecord[]> {
  const records: PayrollRecord[] = [];
  const seen = new Set<string>();
  const add = (record: PayrollRecord) => {
    const key = `${record.employeeId}|${record.period}`;
    if (!seen.has(key)) { seen.add(key); records.push(record); }
  };

  for (const { branch, periods, salaries, incentives } of await loadBranches()) {
    const calculated = periods.filter(period => period.run && period.run.status !== 'DRAFT');
    const runs = await Promise.all(calculated.map(period => payrollApi.run(period.run!.id)));
    runs.forEach((run, index) => {
      const period = periodKey(calculated[index].year, calculated[index].month);
      for (const entry of run.entries) {
        add({
          employeeId: entry.userId, employeeName: entry.user?.name, branch: branch.name, period,
          basicSalary: toMoney(entry.basicAmount), gross: toMoney(entry.grossAmount),
          deductions: toMoney(entry.deductionsAmount), incentives: entry.components.filter(component => component.code === 'INCENTIVE').reduce((sum, component) => sum + toMoney(component.amount), 0),
          runStatus: run.status, entryId: entry.id, paid: Boolean(entry.payment),
        });
      }
    });

    const openMonths = new Set([currentPayrollMonth(), ...periods.filter(period => !calculated.includes(period)).map(period => periodKey(period.year, period.month))]);
    for (const month of openMonths) {
      if (calculated.some(period => periodKey(period.year, period.month) === month)) continue;
      for (const salary of salaries) if (coversMonth(salary, month)) {
        const [year, monthNumber] = month.split('-').map(Number);
        const incentive = incentives.find(item => item.userId === salary.userId && item.year === year && item.month === monthNumber);
        add(fromAssignment(salary, branch.name, month, toMoney(incentive?.amount)));
      }
    }
  }
  return records;
}

/** Payroll inputs: sets up the employee's monthly salary in the backend (one time per employee). */
export async function savePayroll(record: PayrollRecord, revisionReason?: string): Promise<PayrollRecord[]> {
  if (!record.employeeId || !record.branch || !/^\d{4}-(0[1-9]|1[0-2])$/.test(record.period) || !Number.isFinite(record.gross) || !Number.isFinite(record.deductions) || record.gross < 0 || record.deductions < 0 || record.deductions > record.gross) {
    throw new Error('Enter valid amounts. Deductions cannot exceed gross earnings.');
  }

  const branches = await getAvailableBranches();
  const branchId = resolveBranchId(branches, record.branch);
  if (!branchId) throw new Error('This employee’s branch could not be found.');

  const all = await loadBranches();
  const data = all.find(item => item.branch.id === branchId);
  const [year, month] = record.period.split('-').map(Number);
  const period = data?.periods.find(item => item.year === year && item.month === month);
  if (period?.run && period.run.status !== 'DRAFT') {
    throw new Error('This month has already been calculated. Salary changes require a separate reviewed correction.');
  }
  const assignments = (data?.salaries ?? []).filter(salary => salary.userId === record.employeeId);
  if (assignments.length > 0) {
    const covering = assignments.filter(salary => coversMonth(salary, record.period));
    if (covering.length !== 1) {
      throw new Error('Salary assignments for this month are ambiguous or missing. Ask payroll administration to review the employee history.');
    }
    const existing = covering[0];
    const existingRecord = fromAssignment(existing, record.branch, record.period);
    const same = Math.abs(existingRecord.gross - record.gross) < 0.005 &&
      Math.abs(existingRecord.deductions - record.deductions) < 0.005;
    if (same) {
      await payrollApi.saveIncentive({ companyId: (await getAdminScope()).companyId, branchId, userId: record.employeeId, year: Number(record.period.slice(0, 4)), month: Number(record.period.slice(5, 7)), amount: String(record.incentives || 0), description: 'Sales incentive' });
      return readPayroll();
    }
    const reason = revisionReason?.trim() ?? '';
    if (reason.length < 5 || reason.length > 500) {
      throw new Error('Enter a salary revision reason (5–500 characters).');
    }
    const effectiveFrom = `${record.period}-01`;
    if (dateOnly(existing.effectiveFrom) >= effectiveFrom) {
      throw new Error(`This salary starts on ${dateOnly(existing.effectiveFrom)}. Choose a later payroll month for a permanent revision; corrections within the starting month require a separate process.`);
    }
    const scope = await getAdminScope();
    await payrollApi.reviseSalary({
      companyId: scope.companyId, branchId,
      userId: record.employeeId, effectiveFrom,
      gross: record.gross.toFixed(2), deductions: record.deductions.toFixed(2),
      reason,
    });
    await payrollApi.saveIncentive({ companyId: scope.companyId, branchId, userId: record.employeeId, year, month, amount: String(record.incentives || 0), description: 'Sales incentive' });
    return readPayroll();
  }

  await assignMonthlySalary({
    userId: record.employeeId, branchId, employeeName: record.employeeName ?? 'Employee',
    gross: record.gross, deductions: record.deductions, effectiveFrom: `${record.period}-01`,
  });
  const scope = await getAdminScope();
  await payrollApi.saveIncentive({ companyId: scope.companyId, branchId, userId: record.employeeId, year, month, amount: String(record.incentives || 0), description: 'Sales incentive' });
  return readPayroll();
}

// ---------------------------------------------------------------- runs ("submitted" = approved in the backend)
export async function readRuns(): Promise<PayrollRun[]> {
  const runs: PayrollRun[] = [];
  for (const { branch, periods } of await loadBranches()) {
    for (const period of periods) {
      if (period.run && ['CALCULATED', 'APPROVED', 'PAID'].includes(period.run.status)) {
        runs.push({ branch: branch.name, period: periodKey(period.year, period.month), status: period.run.status === 'CALCULATED' ? 'calculated' : 'submitted', submittedAt: period.updatedAt, canApprove: period.run.canApprove === true });
      }
    }
  }
  return runs;
}

/** Creates the period if needed and calculates it. Another authorized user must approve. */
export async function submitPayrollRun(branchName: string, period: string): Promise<void> {
  const scope = await getAdminScope();
  const branches = await getAvailableBranches();
  const branchId = resolveBranchId(branches, branchName);
  if (!branchId) throw new Error('Choose a branch before submitting payroll.');
  const [year, month] = period.split('-').map(Number);
  const existing = (await payrollApi.periods(scope.companyId, branchId)).find(item => item.year === year && item.month === month);
  const payrollPeriod = existing ?? await payrollApi.createPeriod({ companyId: scope.companyId, branchId, year, month });
  if (payrollPeriod.run && ['APPROVED', 'PAID'].includes(payrollPeriod.run.status)) throw new Error('This payroll run has already been submitted.');
  const run = await payrollApi.calculate(payrollPeriod.id);
  if (run.status !== 'CALCULATED') throw new Error('Unexpected payroll calculation status.');
}

export async function saveRuns(next: PayrollRun[]): Promise<void> {
  const current = await readRuns();
  for (const run of next) {
    if (!current.some(item => item.branch === run.branch && item.period === run.period)) {
      await submitPayrollRun(run.branch, run.period);
    }
  }
}

/** Approval is deliberately a separate user action; backend also enforces maker-checker. */
export async function approvePayrollRun(branchName: string, period: string): Promise<void> {
  const scope = await getAdminScope();
  const branches = await getAvailableBranches();
  const branchId = resolveBranchId(branches, branchName);
  if (!branchId) throw new Error('Choose a valid branch.');
  const [year, month] = period.split('-').map(Number);
  const selected = (await payrollApi.periods(scope.companyId, branchId)).find(item => item.year === year && item.month === month);
  if (!selected?.run || selected.run.status !== 'CALCULATED') {
    throw new Error('No calculated payroll run is awaiting approval for this period.');
  }
  if (!selected.run.canApprove) {
    throw new Error('This payroll is awaiting approval by another authorized administrator.');
  }
  await payrollApi.approve(selected.run.id);
}

/** Publishes payslips for an approved payroll run; payment confirmation remains separate. */
export async function publishPayrollRun(branchName: string, period: string): Promise<void> {
  const scope = await getAdminScope();
  const branches = await getAvailableBranches();
  const branchId = resolveBranchId(branches, branchName);
  if (!branchId) throw new Error('Choose a valid branch.');
  const [year, month] = period.split('-').map(Number);
  const selected = (await payrollApi.periods(scope.companyId, branchId)).find(item => item.year === year && item.month === month);
  if (!selected?.run || !['APPROVED', 'PAID'].includes(selected.run.status)) {
    throw new Error('No approved payroll run is available to publish for this period.');
  }
  await payrollApi.publish(selected.run.id);
}
