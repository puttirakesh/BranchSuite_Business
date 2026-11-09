import React, { forwardRef } from 'react';
import { ScrollView, type ScrollViewInstance, type ScrollViewProps } from 'react-native';

export type KeyboardAwareScrollView = ScrollViewInstance;

// Web uses the browser's own focused-input and viewport behavior.
export const KeyboardAwareScrollView = forwardRef<ScrollViewInstance, ScrollViewProps>(function KeyboardAwareScrollView(props, ref) {
  return <ScrollView keyboardShouldPersistTaps="handled" {...props} ref={ref} />;
});
