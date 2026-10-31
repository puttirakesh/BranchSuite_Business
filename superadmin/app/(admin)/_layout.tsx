import React from 'react';
import { Stack } from 'expo-router';
import { SessionGate } from '../../src/core/auth/SessionGate';
import { WorkspaceLayout } from '../../src/shared/components/WorkspaceLayout';
import { QuickActionProvider } from '../../src/shared/components/QuickActions';
import { colors } from '../../src/theme/tokens';

/**
 * Signed-in area for BOTH platform roles (Platform Admin and Platform Support).
 * Each route checks its own capability with RequireCapability, and the sidebar and
 * bottom bar only show modules the signed-in role can open.
 */
export default function AdminLayout() {
  return (
    <SessionGate require="signedIn">
      <QuickActionProvider>
        <WorkspaceLayout>
          <Stack screenOptions={{ headerShown: false, animation: 'none', contentStyle: { backgroundColor: colors.bg } }} />
        </WorkspaceLayout>
      </QuickActionProvider>
    </SessionGate>
  );
}
