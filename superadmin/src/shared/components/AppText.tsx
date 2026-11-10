import React from 'react';
import { Platform, StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';
import { colors, typography } from '../../theme/tokens';

type Variant = 'h1' | 'homeH1' | 'h2' | 'h3' | 'body' | 'small' | 'tiny' | 'eyebrow' | 'label' | 'value';

export function AppText({ variant = 'body', color, style, ...rest }: TextProps & { variant?: Variant; color?: string }) {
  return <Text {...rest} style={[styles[variant], color ? { color } : null, style]} />;
}

const styles = StyleSheet.create<Record<Variant, TextStyle>>({
  h1: { ...typography.h1, fontFamily: Platform.OS === 'web' ? typography.fontFamily : undefined, color: colors.ink },
  homeH1: { ...typography.homeH1, fontFamily: Platform.OS === 'web' ? typography.fontFamily : undefined, color: colors.ink },
  h2: { ...typography.h2, fontFamily: Platform.OS === 'web' ? typography.fontFamily : undefined, color: colors.ink },
  h3: { ...typography.h3, fontFamily: Platform.OS === 'web' ? typography.fontFamily : undefined, color: colors.ink },
  body: { ...typography.body, fontFamily: Platform.OS === 'web' ? typography.fontFamily : undefined, color: colors.ink },
  small: { ...typography.small, fontFamily: Platform.OS === 'web' ? typography.fontFamily : undefined, color: colors.muted },
  tiny: { ...typography.tiny, fontFamily: Platform.OS === 'web' ? typography.fontFamily : undefined, color: colors.subtle },
  eyebrow: { ...typography.eyebrow, fontFamily: Platform.OS === 'web' ? typography.fontFamily : undefined, textTransform: 'uppercase', color: '#6F7B90' },
  label: { ...typography.label, fontFamily: Platform.OS === 'web' ? typography.fontFamily : undefined, color: colors.label },
  value: { ...typography.value, fontFamily: Platform.OS === 'web' ? typography.fontFamily : undefined, color: colors.inkStrong },
});
