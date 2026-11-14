import React from 'react';
import { KeyboardProvider } from 'react-native-keyboard-controller';

export function AppKeyboardProvider({ children }: { children: React.ReactNode }) {
  // Screens own their safe-area padding. Without these flags the controller can
  // also add native system-bar margins, especially in development hosts.
  return <KeyboardProvider preload={false} statusBarTranslucent navigationBarTranslucent preserveEdgeToEdge>{children}</KeyboardProvider>;
}
