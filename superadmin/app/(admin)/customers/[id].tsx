import React from 'react';
import { RequireCapability } from '../../../src/core/permissions/RequireCapability';
import { useRouteId } from '../../../src/shared/hooks/useRouteId';
import { CustomerDetailsScreen } from '../../../src/features/customers/screens/CustomerDetailsScreen';

export default function Route() {
  const id = useRouteId();
  return <RequireCapability capability="customers.view"><CustomerDetailsScreen key={id} id={id} /></RequireCapability>;
}
