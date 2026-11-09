import type { DataMode } from '../config/env';
import { can, type Capability, type Role } from './roles';

/**
 * Defense-in-depth for queries whose screens may be mounted indirectly.
 * Preview data stays available for UI review, while real API requests require
 * both the relevant capability and an actively visible consumer.
 */
export function canRunQuery(
  mode: DataMode,
  role: Role | null | undefined,
  capability: Capability,
  visible = true,
): boolean {
  return visible && (mode !== 'api' || can(role, capability));
}

/** Internal notes are persisted platform-only by the API (visibility INTERNAL) and available in preview too. */
export function canComposeInternalNote(_mode: DataMode, role: Role | null | undefined): boolean {
  return can(role, 'support.internalNote');
}
