import React from 'react';
import { RequireCapability } from '../../../src/core/permissions/RequireCapability';
import { MoreScreen } from '../../../src/features/dashboard/screens/MoreScreen';

export default function Route() {
  return <RequireCapability capability="dashboard.view"><MoreScreen /></RequireCapability>;
}
