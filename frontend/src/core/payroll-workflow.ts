import type { PayrollRun } from './payroll';

export type PayrollAction = {
  kind: 'calculate' | 'approve' | 'publish' | 'waiting' | 'published';
  label: string;
  busyLabel: string;
  disabled: boolean;
  hint: string;
};

/** The overview and review pages share one action for the selected branch and month. */
export function payrollAction({ branch, run, loading, error, saving, recordCount, checks, canPrepare = true }: {
  branch: string;
  run?: PayrollRun;
  loading: boolean;
  error: string;
  saving: boolean;
  recordCount: number;
  checks: number;
  canPrepare?: boolean;
}): PayrollAction {
  const blocked = loading || !!error || saving || !branch;
  if (!canPrepare && (!run || run.status === 'draft' || run.status === 'submitted' && !run.publishedAt)) return { kind: 'waiting', label: run?.status === 'submitted' ? 'Awaiting Payslip Publication' : 'Awaiting Payroll Preparation', busyLabel: 'Loading…', disabled: true, hint: 'A business administrator or payroll officer must prepare and publish this payroll.' };
  if (run?.status === 'submitted') {
    return run.publishedAt
      ? {
          kind: 'published', label: `Published Payslips for ${branch}`, busyLabel: 'Publishing…', disabled: true,
          hint: `Payslips are published for ${branch} for the selected month.`,
        }
      : {
          kind: 'publish', label: 'Publish Approved Payslips', busyLabel: 'Publishing…', disabled: blocked,
          hint: 'Payroll is approved. Publish the payslips to make them available to employees.',
        };
  }
  if (run?.status === 'calculated') {
    return run.canApprove
      ? {
          kind: 'approve', label: 'Verify & Approve Payroll', busyLabel: 'Approving…', disabled: blocked,
          hint: 'Review the calculated amounts before approving this branch payroll.',
        }
      : {
          kind: 'waiting', label: 'Awaiting Approval', busyLabel: 'Calculating…', disabled: true,
          hint: 'An assigned company or branch manager must verify and approve this payroll.',
        };
  }
  return {
    kind: 'calculate', label: 'Calculate Payroll', busyLabel: 'Calculating…',
    disabled: blocked || !recordCount || checks > 0,
    hint: !branch ? 'Choose a branch to prepare its payroll run.'
      : !recordCount ? 'Add payroll inputs for this period first.'
      : checks > 0 ? 'Resolve payroll checks before calculating.'
      : 'Calculate payroll from saved salary assignments. A different administrator must approve.',
  };
}
