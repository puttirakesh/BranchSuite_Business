import React from 'react';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';

// Modals render in their own window, so shrink their content above the keyboard here.
export function ModalKeyboardAvoider({ children }: { children: React.ReactNode }) {
  return <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>{children}</KeyboardAvoidingView>;
}
