import React from 'react';
import { Platform, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';

// Android's RN Modal already uses adjustResize. Padding by the keyboard height
// again shrinks forms twice (the branch form collapsed to one field in the video).
export function ModalKeyboardAvoider({ children }: { children: React.ReactNode }) {
  if (Platform.OS === 'android') return <View style={{ flex: 1, minHeight: 0 }}>{children}</View>;
  return <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>{children}</KeyboardAvoidingView>;
}
