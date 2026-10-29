import React from 'react';
import Feather from '@expo/vector-icons/Feather';
import { StyleSheet, type StyleProp, type TextStyle } from 'react-native';
import { iconSymbols as symbols, type AppIconName } from './app-icon-symbols';

export type { AppIconName } from './app-icon-symbols';

// Resolve symbols still used by older screens to consistent Feather icons.

type Props = {
  name?: AppIconName;
  symbol?: string;
  size?: number | string;
  color?: string;
  style?: StyleProp<TextStyle>;
};

/** One scalable outline icon set for native and web, including inline labels. */
export function AppIcon({ name, symbol, size, color, style }: Props) {
  if (!name && !symbol?.trim()) return null;
  const flattened = StyleSheet.flatten(style) ?? {};
  const {
    fontFamily: _fontFamily,
    fontWeight: _fontWeight,
    letterSpacing: _letterSpacing,
    lineHeight: _lineHeight,
    fontSize,
    ...layout
  } = flattened;
  const key = symbol?.trim() ?? '';
  const resolved = name ?? symbols[key]
    ?? (Object.hasOwn(Feather.glyphMap, key) ? key as AppIconName : 'circle');
  const dimension = typeof size === 'number' ? size
    : resolved.startsWith('chevron-') ? 18 : Math.max(18, fontSize ?? 20);
  return (
    <Feather
      name={resolved}
      size={dimension}
      color={color ?? flattened.color ?? '#607591'}
      style={layout}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}

export function createAppIcon(name: AppIconName) {
  return function Icon(props: Omit<Props, 'name' | 'symbol'>) {
    return <AppIcon {...props} name={name} />;
  };
}
