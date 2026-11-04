import React from 'react';
import { RequireCapability } from '../../../src/core/permissions/RequireCapability';
import { useRouteId } from '../../../src/shared/hooks/useRouteId';
import { PlansScreen } from '../../../src/features/plans/screens/PlansScreen';

export default function Route() {
  const id = useRouteId();
  return <RequireCapability capability="plans.manage"><PlansScreen key={id} openEditor={id} /></RequireCapability>;
}
