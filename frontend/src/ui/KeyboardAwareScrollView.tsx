import React, { forwardRef } from 'react';
import { ScrollView, type ScrollViewProps } from 'react-native';

export type KeyboardAwareScrollView = ScrollView;

// Web uses the browser's own focused-input and viewport behavior.
export const KeyboardAwareScrollView = forwardRef<ScrollView, ScrollViewProps>(function KeyboardAwareScrollView(props, ref) {
  return <ScrollView keyboardShouldPersistTaps="handled" {...props} ref={ref} />;
});
