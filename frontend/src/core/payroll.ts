
import { payrollApi, type EmployeeSalaryDto, type PayrollPeriodDto } from './admin/api';
import { getAdminScope, getCompanyBranches, resolveBranchId } from './admin/scope';
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
export type PayrollRun = { branch: string; period: string; status: 'submitted'; submittedAt: string };

const pad = (value: number) => String(value).padStart(2, '0');
const periodKey = (year: number, month: number) => `${year}-${pad(month)}`;
export const currentPayrollMonth = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()).slice(0, 7);

type BranchPayroll = { branch: { id: string; name: string }; periods: PayrollPeriodDto[]; salaries: EmployeeSalaryDto[] };

async function loadBranches(): Promise<BranchPayroll[]> {
  const scope = await getAdminScope();
  const branches = (await getCompanyBranches()).filter(branch => branch.status === 'ACTIVE');
  return Promise.all(branches.map(async branch => {
    const [periods, salaries] = await Promise.all([
      payrollApi.periods(scope.companyId, branch.id),
      payrollApi.salaries(scope.companyId, branch.id),
    ]);
    return { branch: { id: branch.id, name: branch.name }, periods, salaries };
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

function fromAssignment(salary: EmployeeSalaryDto, branch: string, period: string): PayrollRecord {
  const basic = toMoney(salary.basicOverride ?? salary.structure.basicAmount);
  const earnings = salary.structure.components.filter(item => item.kind === 'EARNING').reduce((sum, item) => sum + toMoney(item.amount), 0);
  const deductions = salary.structure.components.filter(item => item.kind === 'DEDUCTION').reduce((sum, item) => sum + toMoney(item.amount), 0);
  return {
    employeeId: salary.userId, employeeName: salary.user?.name, branch, period,
    basicSalary: basic, gross: basic + earnings, deductions, incentives: 0,
  };
}

export async function readPayroll(): Promise<PayrollRecord[]> {
  const records: PayrollRecord[] = [];
  const seen = new Set<string>();
  const add = (record: PayrollRecord) => {
    const key = `${record.employeeId}|${record.period}`;
    if (!seen.has(key)) { seen.add(key); records.push(record); }
  };

  for (const { branch, periods, salaries } of await loadBranches()) {
    const calculated = periods.filter(period => period.run && period.run.status !== 'DRAFT');
    const runs = await Promise.all(calculated.map(period => payrollApi.run(period.run!.id)));
    runs.forEach((run, index) => {
      const period = periodKey(calculated[index].year, calculated[index].month);
      for (const entry of run.entries) {
        add({
          employeeId: entry.userId, employeeName: entry.user?.name, branch: branch.name, period,
          basicSalary: toMoney(entry.basicAmount), gross: toMoney(entry.grossAmount),
          deductions: toMoney(entry.deductionsAmount), incentives: 0,
          runStatus: run.status, entryId: entry.id, paid: Boolean(entry.payment),
        });
      }
    });

    const openMonths = new Set([currentPayrollMonth(), ...periods.filter(period => !calculated.includes(period)).map(period => periodKey(period.year, period.month))]);
    for (const month of openMonths) {
      if (calculated.some(period => periodKey(period.year, period.month) === month)) continue;
      for (const salary of salaries) if (coversMonth(salary, month)) add(fromAssignment(salary, branch.name, month));
    }
  }
  return records;
}

/** Payroll inputs: sets up the employee's monthly salary in the backend (one time per employee). */
export async function savePayroll(record: PayrollRecord): Promise<PayrollRecord[]> {
  if (!record.employeeId || !record.branch || !/^\d{4}-(0[1-9]|1[0-2])$/.test(record.period) || !Number.isFinite(record.gross) || !Number.isFinite(record.deductions) || record.gross < 0 || record.deductions < 0 || record.deductions > record.gross) {
    throw new Error('Enter valid amounts. Deductions cannot exceed gross earnings.');
  }
  if ((record.incentives || 0) > 0) throw new Error('Incentives are not supported by the payroll backend yet. Set incentives to 0.');

  const branches = (await getCompanyBranches()).filter(branch => branch.status === 'ACTIVE');
  const branchId = resolveBranchId(branches, record.branch);
  if (!branchId) throw new Error('This employee’s branch could not be found.');

  const all = await loadBranches();
  const data = all.find(item => item.branch.id === branchId);
  const [year, month] = record.period.split('-').map(Number);
  const period = data?.periods.find(item => item.year === year && item.month === month);
  if (period?.run && ['APPROVED', 'PAID'].includes(period.run.status)) throw new Error('This payroll run has already been submitted.');
  if (data?.salaries.some(salary => salary.userId === record.employeeId)) {
    throw new Error('This employee already has a salary. Revising salaries is not supported by the backend yet.');
  }

  await assignMonthlySalary({
    userId: record.employeeId, branchId, employeeName: record.employeeName ?? 'Employee',
    gross: record.gross, deductions: record.deductions, effectiveFrom: `${record.period}-01`,
  });
  return readPayroll();
}

// ---------------------------------------------------------------- runs ("submitted" = approved in the backend)
export async function readRuns(): Promise<PayrollRun[]> {
  const runs: PayrollRun[] = [];
  for (const { branch, periods } of await loadBranches()) {
    for (const period of periods) {
      if (period.run && ['APPROVED', 'PAID'].includes(period.run.status)) {
        runs.push({ branch: branch.name, period: periodKey(period.year, period.month), status: 'submitted', submittedAt: period.updatedAt });
      }
    }
  }
  return runs;
}

/** Creates the period if needed, calculates it from salary assignments and approves the run. */
export async function submitPayrollRun(branchName: string, period: string): Promise<void> {
  const scope = await getAdminScope();
  const branches = (await getCompanyBranches()).filter(branch => branch.status === 'ACTIVE');
  const branchId = resolveBranchId(branches, branchName);
  if (!branchId) throw new Error('Choose a branch before submitting payroll.');
  const [year, month] = period.split('-').map(Number);
  const existing = (await payrollApi.periods(scope.companyId, branchId)).find(item => item.year === year && item.month === month);
  const payrollPeriod = existing ?? await payrollApi.createPeriod({ companyId: scope.companyId, branchId, year, month });
  if (payrollPeriod.run && ['APPROVED', 'PAID'].includes(payrollPeriod.run.status)) throw new Error('This payroll run has already been submitted.');
  const run = await payrollApi.calculate(payrollPeriod.id);
  if (run.status === 'CALCULATED') await payrollApi.approve(run.id);
}

export async function saveRuns(next: PayrollRun[]): Promise<void> {
  const current = await readRuns();
  for (const run of next) {
    if (!current.some(item => item.branch === run.branch && item.period === run.period)) {
      await submitPayrollRun(run.branch, run.period);
    }
  }
}
