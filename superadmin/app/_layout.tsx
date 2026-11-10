import './global.css';
import React, { useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { isAppError } from '../src/core/api/api-error';
import { AuthProvider } from '../src/core/auth/AuthContext';
import { ToastProvider } from '../src/shared/components';
import { colors } from '../src/theme/tokens';

export { ErrorBoundary } from '../src/shared/components/ErrorBoundary';

export default function RootLayout() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            // Only transient failures are retried; configuration and permission errors are final.
            retry: (count, error) => count < 2 && (!isAppError(error) || error.kind === 'network' || error.kind === 'server'),
          },
        },
      }),
  );
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ToastProvider>
            <StatusBar style="dark" />
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
          </ToastProvider>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
