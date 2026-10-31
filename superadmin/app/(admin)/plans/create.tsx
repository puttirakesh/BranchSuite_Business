import React from 'react';
import { RequireCapability } from '../../../src/core/permissions/RequireCapability';
import { PlansScreen } from '../../../src/features/plans/screens/PlansScreen';

export default function Route() {
  return <RequireCapability capability="plans.manage"><PlansScreen openEditor="new" /></RequireCapability>;
}
