import React, { forwardRef } from 'react';
import type { ScrollView, ScrollViewProps } from 'react-native';
import { KeyboardAwareScrollView as NativeKeyboardScrollView } from 'react-native-keyboard-controller';

export type KeyboardAwareScrollView = ScrollView;

// Native focus, selection, and keyboard-animation events drive the movement.
export const KeyboardAwareScrollView = forwardRef<ScrollView, ScrollViewProps>(function KeyboardAwareScrollView(props, ref) {
  return <NativeKeyboardScrollView
    keyboardShouldPersistTaps="handled"
    {...props}
    automaticallyAdjustKeyboardInsets={false}
    bottomOffset={32}
    mode="insets"
    disableScrollOnKeyboardHide
    ref={node => {
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    }}
  />;
});
