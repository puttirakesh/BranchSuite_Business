import React from 'react';
import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';
import { colors } from '../../theme/tokens';

type Variant = 'h1' | 'homeH1' | 'h2' | 'h3' | 'body' | 'small' | 'tiny' | 'eyebrow' | 'label' | 'value';

export function AppText({ variant = 'body', color, style, ...rest }: TextProps & { variant?: Variant; color?: string }) {
  return <Text {...rest} style={[styles[variant], color ? { color } : null, style]} />;
}

const styles = StyleSheet.create<Record<Variant, TextStyle>>({
  h1: { fontSize: 30, fontWeight: '700', letterSpacing: -0.75, lineHeight: 36, color: colors.ink },
  homeH1: { fontSize: 33, fontWeight: '700', letterSpacing: -0.9, lineHeight: 38, color: colors.ink },
  h2: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3, lineHeight: 24, color: colors.ink },
  h3: { fontSize: 15, fontWeight: '700', lineHeight: 21, color: colors.ink },
  body: { fontSize: 13, lineHeight: 20, color: colors.ink },
  small: { fontSize: 12, lineHeight: 18, color: colors.muted },
  tiny: { fontSize: 10, lineHeight: 15, color: colors.subtle },
  eyebrow: { fontSize: 9, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', color: '#6F7B90' },
  label: { fontSize: 13, fontWeight: '600', lineHeight: 19, color: colors.label },
  value: { fontSize: 27, fontWeight: '700', letterSpacing: -0.8, lineHeight: 31, color: colors.inkStrong },
});
