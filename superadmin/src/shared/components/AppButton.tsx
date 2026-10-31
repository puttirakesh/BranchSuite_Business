import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { colors, radii, spacing, typography } from '../../theme/tokens';

interface Props {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  destructive?: boolean;
}

export default function AppButton({ title, onPress, disabled, loading, destructive }: Props) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading} onPress={onPress}
      style={({ pressed }) => [styles.button, destructive && styles.destructive, (pressed || disabled || loading) && styles.dimmed]}>
      {loading ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.text}>{title}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 48, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, backgroundColor: colors.primary, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  destructive: { backgroundColor: colors.danger },
  dimmed: { opacity: 0.6 },
  text: { color: colors.surface, fontWeight: '700', fontSize: typography.button },
});
