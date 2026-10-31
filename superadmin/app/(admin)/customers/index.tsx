import React from 'react';
import { RequireCapability } from '../../../src/core/permissions/RequireCapability';
import { CustomersScreen } from '../../../src/features/customers/screens/CustomersScreen';

export default function Route() {
  return <RequireCapability capability="customers.view"><CustomersScreen /></RequireCapability>;
}
