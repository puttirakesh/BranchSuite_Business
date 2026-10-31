import React from 'react';
import { RequireCapability } from '../../../src/core/permissions/RequireCapability';
import { SupportTicketsScreen } from '../../../src/features/support/screens/SupportTicketsScreen';

export default function Route() {
  return <RequireCapability capability="support.view"><SupportTicketsScreen /></RequireCapability>;
}
