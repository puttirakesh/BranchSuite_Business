import React from 'react';
import { KeyboardProvider } from 'react-native-keyboard-controller';

export function AppKeyboardProvider({ children }: { children: React.ReactNode }) {
  return <KeyboardProvider preload={false}>{children}</KeyboardProvider>;
}
