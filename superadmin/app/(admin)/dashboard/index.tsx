import React from 'react';
import { RequireCapability } from '../../../src/core/permissions/RequireCapability';
import { AdminDashboardScreen } from '../../../src/features/dashboard/screens/AdminDashboardScreen';

export default function Route() {
  return <RequireCapability capability="dashboard.view"><AdminDashboardScreen /></RequireCapability>;
}
