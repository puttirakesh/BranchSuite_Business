import React from 'react';
import { RequireCapability } from '../../../src/core/permissions/RequireCapability';
import { useRouteId } from '../../../src/shared/hooks/useRouteId';
import { InvoiceDetailsScreen } from '../../../src/features/billing/screens/InvoiceDetailsScreen';

export default function Route() {
  const id = useRouteId();
  return <RequireCapability capability="billing.view"><InvoiceDetailsScreen key={id} id={id} /></RequireCapability>;
}
