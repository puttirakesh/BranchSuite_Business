import React from 'react';
import { RequireCapability } from '../../../src/core/permissions/RequireCapability';
import { SupportBusinessesScreen } from '../../../src/features/support/screens/SupportBusinessesScreen';
export default function Route() { return <RequireCapability capability="support.businesses.view"><SupportBusinessesScreen /></RequireCapability>; }
