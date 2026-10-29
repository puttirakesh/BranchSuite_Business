
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '../src/core/auth/AuthContext';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
