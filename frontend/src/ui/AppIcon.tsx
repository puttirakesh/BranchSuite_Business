import React from 'react';
import Feather from '@expo/vector-icons/Feather';
import { StyleSheet, type StyleProp, type TextStyle } from 'react-native';

export type AppIconName = React.ComponentProps<typeof Feather>['name'];

// Resolve symbols still used by older screens to consistent Feather icons.
const symbols: Record<string, AppIconName> = {
  '⌄': 'chevron-down', '▾': 'chevron-down', '▼': 'chevron-down',
  '∨': 'chevron-down', '⌃': 'chevron-up',
  '›': 'chevron-right', '‹': 'chevron-left',
  '→': 'arrow-right', '←': 'arrow-left',
  '⌕': 'search', '♙': 'users', '👥': 'users',
  '◷': 'clock', '☑': 'check-square', '☐': 'square',
  '☷': 'list', '⌂': 'home', '↗': 'trending-up',
  '▤': 'file-text', '▥': 'bar-chart-2', '▦': 'grid',
  '₹': 'credit-card', '✓': 'check', '×': 'x', '+': 'plus',
  '−': 'minus', 'ⓘ': 'info', '♧': 'calendar',
  '···': 'more-horizontal', '…': 'more-horizontal',
  '✉': 'mail', '🔐': 'lock', '⚙': 'settings', '☎': 'phone',
  calendar: 'calendar', document: 'file-text', help: 'headphones',
  building: 'briefcase', '◇': 'clipboard', '▣': 'credit-card',
  '◉': 'check-circle', '○': 'circle',
};

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
