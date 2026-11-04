import type { PillTone } from '../../theme/tokens';

/** Badge colour rules from the APK (saas-ui.js `badge`). */
export function statusTone(status: string): PillTone {
  if (['Active', 'Paid', 'Resolved', 'Converted', 'Enabled', 'Completed'].includes(status)) return 'green';
  if (['Expired', 'Suspended', 'Cancelled', 'Failed', 'Closed', 'Disabled', 'Overdue'].includes(status)) return 'red';
  if (['Trial', 'Past due', 'Unpaid', 'Open', 'Issued', 'Draft', 'Paused'].includes(status)) return 'amber';
  return 'purple';
}
