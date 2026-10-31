import type { ReactNode } from 'react';
import { View } from 'react-native';
import LoadingState from '../../shared/components/LoadingState';
import ErrorState from '../../shared/components/ErrorState';
import AppButton from '../../shared/components/AppButton';
import { useAuth } from './AuthContext';

export default function SessionGate({ children }: { children: ReactNode }) {
  const { loading, sessionError, restoreSession, logout } = useAuth();
  if (loading) return <LoadingState message="Restoring session..." />;
  if (sessionError) return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 20 }}>
      <ErrorState message={sessionError} onRetry={() => { void restoreSession(); }} />
      <AppButton title="Clear session and sign in" onPress={() => { void logout(); }} />
    </View>
  );
  return children;
}
