import React from 'react';
import { RequireCapability } from '../../../src/core/permissions/RequireCapability';
import { AuditScreen } from '../../../src/features/audit/screens/AuditScreen';

export default function Route() {
  return <RequireCapability capability="audit.view"><AuditScreen /></RequireCapability>;
}
