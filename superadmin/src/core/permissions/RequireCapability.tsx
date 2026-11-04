import React from 'react';
import { View } from 'react-native';
import { AppError } from '../api/api-error';
import { usePermission } from './usePermission';
import type { Capability } from './roles';
import { ErrorState, Screen } from '../../shared/components';

/** Route-level guard. Hidden nav items are not enough because routes can be deep-linked. */
export function RequireCapability({ capability, children }: { capability: Capability; children: React.ReactNode }) {
  const allowed = usePermission(capability);
  if (allowed) return <>{children}</>;
  return (
    <Screen>
      <View style={{ marginTop: 40 }}>
        <ErrorState error={new AppError('forbidden', 'Your role does not include this module. Ask a Platform Admin if you need access.')} />
      </View>
    </Screen>
  );
}
