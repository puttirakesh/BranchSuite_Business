import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius } from '../../theme/tokens';
import { Icon, type IconName } from './Icon';

type Variant = 'primary' | 'secondary' | 'soft' | 'text';

interface Props {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  small?: boolean;
  full?: boolean;
  icon?: IconName;
  trailingIcon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}

/** APK `.btn` with `.secondary`, `.soft`, `.small`, `.full` and `.text-button` variants. */
export function Button({ label, onPress, variant = 'primary', small, full, icon, trailingIcon, loading, disabled, style, accessibilityHint }: Props) {
  const palette = variants[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        small ? styles.small : null,
        full ? styles.full : null,
        { backgroundColor: palette.bg, borderColor: palette.border },
        variant === 'text' ? styles.text : null,
        variant === 'primary' ? styles.raised : null,
        pressed && !inactive ? { opacity: 0.86 } : null,
        inactive ? { opacity: 0.55 } : null,
        style,
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={palette.fg} /> : icon ? <Icon name={icon} size={16} color={palette.fg} /> : null}
      <Text style={[styles.label, small ? styles.smallLabel : null, { color: palette.fg }]} numberOfLines={1}>
        {label}
      </Text>
      {trailingIcon ? <View><Icon name={trailingIcon} size={15} color={palette.fg} /></View> : null}
    </Pressable>
  );
}

const variants: Record<Variant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.primary, fg: '#FFFFFF', border: colors.primary },
  secondary: { bg: colors.surface, fg: '#344763', border: colors.lineStrong },
  soft: { bg: colors.primarySoft, fg: colors.primary, border: colors.primarySoft },
  text: { bg: 'transparent', fg: colors.primary, border: 'transparent' },
};

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  small: { minHeight: 44, paddingHorizontal: 15, paddingVertical: 10 },
  full: { alignSelf: 'stretch' },
  text: { minHeight: 44, paddingHorizontal: 0 },
  raised: { shadowColor: '#253C76', shadowOpacity: 0.07, shadowRadius: 7, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  label: { fontSize: 14, fontWeight: '700' },
  smallLabel: { fontSize: 13 },
});
export { Button as AppButton };
