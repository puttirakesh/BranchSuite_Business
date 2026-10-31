import React from 'react';
import { RequireCapability } from '../../../src/core/permissions/RequireCapability';
import { SettingsScreen } from '../../../src/features/settings/screens/SettingsScreen';

export default function Route() {
  return <RequireCapability capability="settings.manage"><SettingsScreen /></RequireCapability>;
}
