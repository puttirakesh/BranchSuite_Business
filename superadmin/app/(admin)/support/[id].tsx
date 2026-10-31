import React from 'react';
import { RequireCapability } from '../../../src/core/permissions/RequireCapability';
import { useRouteId } from '../../../src/shared/hooks/useRouteId';
import { TicketDetailsScreen } from '../../../src/features/support/screens/TicketDetailsScreen';

export default function Route() {
  const id = useRouteId();
  return <RequireCapability capability="support.view"><TicketDetailsScreen key={id} id={id} /></RequireCapability>;
}
