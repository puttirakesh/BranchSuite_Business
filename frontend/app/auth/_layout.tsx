import React from "react";
import { Stack } from "expo-router";
import { usePageTransitions } from '../../src/ui/usePageTransitions';

export default function AuthLayout() {
  const screenOptions = usePageTransitions();
  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="login" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="plans" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="reset-password" />
      <Stack.Screen name="accept-invitation" />
    </Stack>
  );
}

