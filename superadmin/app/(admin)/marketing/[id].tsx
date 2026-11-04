import React from 'react';
import { RequireCapability } from '../../../src/core/permissions/RequireCapability';
import { useRouteId } from '../../../src/shared/hooks/useRouteId';
import { ProspectDetailsScreen } from '../../../src/features/marketing/screens/ProspectDetailsScreen';

export default function Route() {
  const id = useRouteId();
  return <RequireCapability capability="marketing.manage"><ProspectDetailsScreen key={id} id={id} /></RequireCapability>;
}
