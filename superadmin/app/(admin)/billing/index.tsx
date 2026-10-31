import React from 'react';
import { RequireCapability } from '../../../src/core/permissions/RequireCapability';
import { BillingScreen } from '../../../src/features/billing/screens/BillingScreen';

export default function Route() {
  return <RequireCapability capability="billing.view"><BillingScreen /></RequireCapability>;
}
