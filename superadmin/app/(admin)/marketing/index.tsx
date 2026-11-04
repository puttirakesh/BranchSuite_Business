import React from 'react';
import { RequireCapability } from '../../../src/core/permissions/RequireCapability';
import { MarketingScreen } from '../../../src/features/marketing/screens/MarketingScreen';

export default function Route() {
  return <RequireCapability capability="marketing.manage"><MarketingScreen /></RequireCapability>;
}
