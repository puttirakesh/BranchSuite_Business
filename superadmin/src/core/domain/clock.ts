import { env } from '../config/env';
import { today } from './dates';

/**
 * The APK evaluates its sample workspace against a fixed "sample day"
 * (saas-model.js TODAY = 2026-10-03). Preview data uses the same day so trial,
 * grace-period and renewal states match the reference app. Real data always uses today.
 */
export const PREVIEW_REFERENCE_DATE = '2026-10-03';

export function businessDate(): string {
  return env.dataMode === 'preview' ? PREVIEW_REFERENCE_DATE : today();
}
