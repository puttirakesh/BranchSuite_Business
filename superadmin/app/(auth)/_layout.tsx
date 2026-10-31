import React from 'react';
import { Stack } from 'expo-router';
import { SessionGate } from '../../src/core/auth/SessionGate';

export default function AuthLayout() {
  return (
    <SessionGate require="signedOut">
      <Stack screenOptions={{ headerShown: false }} />
    </SessionGate>
  );
}
