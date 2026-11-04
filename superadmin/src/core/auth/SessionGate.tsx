import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { colors } from '../../theme/tokens';
import { useAuth } from './AuthContext';

/**
 * Decides what a route group may show for the current session.
 * - `signedIn`: the admin area. Signed-out users are sent to /login.
 * - `signedOut`: the auth screens. Signed-in users are sent to /dashboard.
 * While the stored session is being restored, a loading indicator is shown.
 */
export function SessionGate({ require, children }: { require: 'signedIn' | 'signedOut'; children: React.ReactNode }) {
  const { status } = useAuth();
  if (status === 'restoring') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }} accessibilityLabel="Loading">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (require === 'signedIn' && status === 'signedOut') return <Redirect href="/login" />;
  if (require === 'signedOut' && status === 'signedIn') return <Redirect href="/dashboard" />;
  return <>{children}</>;
}
