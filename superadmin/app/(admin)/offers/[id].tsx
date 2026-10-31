import React from 'react';
import { RequireCapability } from '../../../src/core/permissions/RequireCapability';
import { useRouteId } from '../../../src/shared/hooks/useRouteId';
import { OffersScreen } from '../../../src/features/offers/screens/OffersScreen';

export default function Route() {
  const id = useRouteId();
  return <RequireCapability capability="offers.manage"><OffersScreen key={id} openOffer={id} /></RequireCapability>;
}
