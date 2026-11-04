import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, shadow } from '../../theme/tokens';

/** APK `.card`: white surface, 19px radius, hairline border, very soft shadow. */
export function Card({ children, style, padded = true }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }) {
  return <View style={[styles.card, padded ? styles.padded : null, style]}>{children}</View>;
}

/** APK `.list-card` and other tappable cards. */
export function PressableCard({ children, onPress, style, accessibilityLabel }: {
  children: React.ReactNode;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.card, styles.list, pressed ? styles.pressed : null, style]}
    >
      {children}
    </Pressable>
  );
}

export const cardStyles = StyleSheet.create({ surface: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, ...shadow } });

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.line, ...shadow },
  padded: { padding: 21 },
  list: { padding: 18 },
  pressed: { borderColor: '#CFC4EA', backgroundColor: '#FDFCFF' },
});
