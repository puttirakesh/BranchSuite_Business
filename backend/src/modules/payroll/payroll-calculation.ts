import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

const D = Prisma.Decimal;
const day = (value: Date | string) => new Date(value).toISOString().slice(0, 10);
type Component = { code: string; name: string; kind: 'EARNING' | 'DEDUCTION'; amount: Prisma.Decimal };
type Salary = { id: string; effectiveFrom: Date; effectiveTo: Date | null; basicOverride: Prisma.Decimal | null; structure: { currency: string; basicAmount: Prisma.Decimal; components: Component[] } };
type Attendance = { attendanceDate: Date; status: string; source: string; checkOutAt: Date | null };
type Leave = { startDate: Date; endDate: Date; status: string; leaveType: { isPaid: boolean } };
export type PayrollCalendar = { weeklyOffDays: number[]; holidays: string[] };
export function calculateEmployeeSalary(input: {
  salaries: Salary[]; start: Date; end: Date; joiningDate?: Date; exitDate?: Date | null;
  attendanceBased: boolean; calendar: PayrollCalendar | null; attendance: Attendance[]; leaves: Leave[];
  pendingCorrections: string[]; halfDayDeduction: string; deductUnpaidLeave: boolean; deductAbsentDays: boolean;
  incentive: { amount: Prisma.Decimal; description: string } | undefined;
}) {
  const start = day(input.start), end = day(input.end);
  const periodDays = Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1;
  if (input.attendanceBased && !input.calendar) throw new ConflictException('Configure the company payroll calendar before calculating attendance payroll.');
  const calendar = input.calendar ?? { weeklyOffDays: [], holidays: [] };
  const attendances = new Map(input.attendance.map(item => [day(item.attendanceDate), item]));
  const seen = new Set<string>();
  const components = new Map<string, Component>();
  let basic = new D(0), paidDays = new D(0);
  const currency = input.salaries[0].structure.currency;
  const add = (code: string, name: string, kind: Component['kind'], value: Prisma.Decimal) => {
    const existing = components.get(code);
    if (existing && existing.kind !== kind) throw new ConflictException('Salary component codes change type within this month. Review salary revisions.');
    components.set(code, { code, name, kind, amount: (existing?.amount ?? new D(0)).add(value) });
  };
  for (const salary of input.salaries) {
    if (salary.structure.currency !== currency) throw new ConflictException('A payroll month cannot combine different salary currencies.');
    const from = [start, day(salary.effectiveFrom), ...(input.joiningDate ? [day(input.joiningDate)] : [])].sort().at(-1)!;
    const to = [end, ...(salary.effectiveTo ? [day(salary.effectiveTo)] : []), ...(input.exitDate ? [day(input.exitDate)] : [])].sort()[0];
    let segmentPaid = new D(0);
    for (let instant = Date.parse(from); instant <= Date.parse(to); instant += 86400000) {
      const key = new Date(instant).toISOString().slice(0, 10);
      if (seen.has(key)) throw new ConflictException('Salary assignments overlap on ' + key + '. Correct the salary effective dates.');
      seen.add(key);
      let unpaid = new D(0);
      if (input.attendanceBased) {
        const off = calendar.weeklyOffDays.includes(new Date(instant).getUTCDay()) || calendar.holidays.includes(key);
        const leaves = input.leaves.filter(item => day(item.startDate) <= key && day(item.endDate) >= key);
        const approved = leaves.filter(item => item.status === 'APPROVED');
        const attendance = attendances.get(key);
        if (!off) {
          if (input.pendingCorrections.includes(key) || leaves.some(item => item.status === 'PENDING')) throw new ConflictException('Resolve pending leave or attendance corrections for ' + key + ' before payroll.');
          if (approved.length > 1) throw new ConflictException('Approved leave overlaps on ' + key + '.');
          if (approved.length) unpaid = new D(!approved[0].leaveType.isPaid && input.deductUnpaidLeave ? 1 : 0);
          else if (!attendance || attendance.status === 'ON_LEAVE' || (attendance.status === 'PRESENT' && attendance.source === 'SELF' && !attendance.checkOutAt)) throw new ConflictException('Missing or incomplete attendance for ' + key + '. Reconcile attendance or approved leave before payroll.');
          else if (attendance.status === 'ABSENT' && input.deductAbsentDays) unpaid = new D(1);
          else if (attendance.status === 'HALF_DAY' && input.deductAbsentDays) unpaid = new D(input.halfDayDeduction);
        }
      }
      segmentPaid = segmentPaid.add(new D(1).sub(unpaid));
    }
    paidDays = paidDays.add(segmentPaid);
    const ratio = segmentPaid.div(periodDays);
    const segmentBasic = new D(salary.basicOverride ?? salary.structure.basicAmount).mul(ratio).toDecimalPlaces(2);
    basic = basic.add(segmentBasic); add('BASIC', 'Basic Salary', 'EARNING', segmentBasic);
    for (const item of salary.structure.components) {
      if (['BASIC', 'INCENTIVE', 'ADVANCE_RECOVERY'].includes(item.code)) throw new BadRequestException('Salary component uses a reserved payroll code.');
      add(item.code, item.name, item.kind, new D(item.amount).mul(ratio).toDecimalPlaces(2));
    }
  }
  if (!seen.size) return null;
  if (input.incentive && new D(input.incentive.amount).greaterThan(0)) add('INCENTIVE', input.incentive.description, 'EARNING', new D(input.incentive.amount));
  const list = [...components.values()];
  const gross = list.filter(item => item.kind === 'EARNING').reduce((sum, item) => sum.add(item.amount), new D(0));
  const deductions = list.filter(item => item.kind === 'DEDUCTION').reduce((sum, item) => sum.add(item.amount), new D(0));
  if (deductions.greaterThan(gross)) throw new BadRequestException('Salary deductions exceed gross earnings.');
  return { basic, gross, deductions, net: gross.sub(deductions), components: list, paidDays, periodDays, currency };
}
