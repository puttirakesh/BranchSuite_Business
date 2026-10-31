import React from 'react';
import { RequireCapability } from '../../../src/core/permissions/RequireCapability';
import { OffersScreen } from '../../../src/features/offers/screens/OffersScreen';

export default function Route() {
  return <RequireCapability capability="offers.manage"><OffersScreen openOffer="new" /></RequireCapability>;
}
