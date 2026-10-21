
import './global.css';
import React from "react";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider } from "../src/core/auth/AuthProvider";
import { usePageTransitions } from '../src/ui/usePageTransitions';
export { ErrorBoundary } from '../src/ui/AppErrorBoundary';

export default function RootLayout() {
  const screenOptions = usePageTransitions();
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <Stack screenOptions={screenOptions}>
          <Stack.Screen name="index" />
          <Stack.Screen name="auth" />
          <Stack.Screen name="admin" />
          <Stack.Screen name="employee" />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
