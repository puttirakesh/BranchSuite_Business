import React from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { useAdminViewport } from './useAdminViewport';

export function DesktopEyebrow({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
}) {
  const { desktop } = useAdminViewport();
  return desktop ? <Text style={style}>{children}</Text> : null;
}
