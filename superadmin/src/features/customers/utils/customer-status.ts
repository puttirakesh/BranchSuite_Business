import { effectiveStatus, SUBSCRIPTION_STATES, type SubscriptionState } from '../../../core/domain/subscription';
import { businessDate } from '../../../core/domain/clock';
import type { Customer } from '../types';

const isState = (v: string): v is SubscriptionState => (SUBSCRIPTION_STATES as readonly string[]).includes(v);

/** Display status for a customer, applying APK expiry and grace rules when dates are known. */
export function customerStatus(c: Customer, onDate = businessDate()): string {
  const s = c.subscription;
  if (c.accountStatus === 'Inactive') return 'Suspended';
  if (!s) return 'No subscription';
  if (isState(s.status) && s.renewOn && s.trialEndsOn && s.graceEndsOn) {
    return effectiveStatus({ ...s, status: s.status }, onDate);
  }
  return s.status;
}
