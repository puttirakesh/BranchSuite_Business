
import './global.css';
import React from "react";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider } from "../src/core/auth/AuthProvider";
import { usePageTransitions } from '../src/ui/usePageTransitions';
import { ToastProvider } from '../src/ui/Toast';
import { AppKeyboardProvider } from '../src/ui/AppKeyboardProvider';
export { ErrorBoundary } from '../src/ui/AppErrorBoundary';

export default function RootLayout() {
  const screenOptions = usePageTransitions();
  return (
    <SafeAreaProvider>
      <AppKeyboardProvider>
      <ToastProvider>
      <AuthProvider>
        <Stack screenOptions={screenOptions}>
          <Stack.Screen name="index" />
          <Stack.Screen name="auth" />
          <Stack.Screen name="admin" />
          <Stack.Screen name="employee" />
        </Stack>
      </AuthProvider>
      </ToastProvider>
      </AppKeyboardProvider>
    </SafeAreaProvider>
  );
}
