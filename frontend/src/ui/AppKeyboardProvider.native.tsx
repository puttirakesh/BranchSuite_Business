import React from 'react';
import { KeyboardProvider, useKeyboardState } from 'react-native-keyboard-controller';
import { KeyboardVisibilityContext } from './KeyboardVisibilityContext';

function KeyboardVisibilityBridge({ children }: { children: React.ReactNode }) {
  const keyboardVisible = useKeyboardState(state => state.isVisible);
  return <KeyboardVisibilityContext.Provider value={keyboardVisible}>{children}</KeyboardVisibilityContext.Provider>;
}

export function AppKeyboardProvider({ children }: { children: React.ReactNode }) {
  // Screens own their safe-area padding. Without these flags the controller can
  // also add native system-bar margins, especially in development hosts.
  return <KeyboardProvider preload={false} statusBarTranslucent navigationBarTranslucent preserveEdgeToEdge>
    <KeyboardVisibilityBridge>{children}</KeyboardVisibilityBridge>
  </KeyboardProvider>;
}
