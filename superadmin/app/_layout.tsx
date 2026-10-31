
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '../src/core/auth/AuthContext';
import SessionGate from '../src/core/auth/SessionGate';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <SessionGate><Stack screenOptions={{ headerShown: false }} /></SessionGate>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
