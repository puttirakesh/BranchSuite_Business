import React, { forwardRef } from 'react';
import type { ScrollViewInstance, ScrollViewProps } from 'react-native';
import { KeyboardAwareScrollView as NativeKeyboardScrollView, type KeyboardAwareScrollViewRef } from 'react-native-keyboard-controller';

export type KeyboardAwareScrollView = ScrollViewInstance;

// Native focus, selection, and keyboard-animation events drive the movement.
export const KeyboardAwareScrollView = forwardRef<ScrollViewInstance, ScrollViewProps>(function KeyboardAwareScrollView(props, ref) {
  return <NativeKeyboardScrollView
    keyboardShouldPersistTaps="handled"
    {...props}
    automaticallyAdjustKeyboardInsets={false}
    bottomOffset={32}
    mode="insets"
    disableScrollOnKeyboardHide
    ref={(node: KeyboardAwareScrollViewRef | null) => {
  if (typeof ref === 'function') {
    ref(node);
  } else if (ref) {
    ref.current = node;
  }
}}
  />;
});

