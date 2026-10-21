import React from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { AppIcon } from './AppIcon';

export function AdminPageHeading({
  title,
  onBack,
  backDisabled = false,
  titleStyle,
  style,
  children,
}: {
  title: string;
  onBack?: () => void;
  backDisabled?: boolean;
  titleStyle?: StyleProp<TextStyle>;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <View style={[style, styles.row]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Go back from ${title}`}
        disabled={backDisabled}
        onPress={onBack ?? (() => router.back())}
        style={styles.back}
      >
        <AppIcon name="arrow-left" size={16} color="#000" />
      </Pressable>
      <View style={styles.text}>
        <Text accessibilityRole="header" style={[styles.title, titleStyle]}>
          {title}
        </Text>
      </View>
      {children ? <View style={styles.action}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { width: '100%', minWidth: 0, flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center', gap: 8 },
  back: { width: 36, height: 44, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0 },
  title: { minWidth: 0, flexShrink: 1, fontSize: 18, lineHeight: 24, fontWeight: '700', color: '#20334f' },
  action: { minWidth: 0, maxWidth: '55%', flexShrink: 1, justifyContent: 'center', alignItems: 'flex-end' },
});
