import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { notes, radius, type NoteTone } from '../../theme/tokens';
import { Icon } from './Icon';

/** APK `.note` information strip. */
export function Note({ children, tone = 'info' }: { children: React.ReactNode; tone?: NoteTone }) {
  const palette = notes[tone];
  return (
    <View style={[styles.note, { backgroundColor: palette.bg }]} accessibilityRole={tone === 'error' ? 'alert' : undefined}>
      <View style={styles.icon}><Icon name="info" size={16} color={palette.fg} /></View>
      <Text style={[styles.text, { color: palette.fg }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  note: { flexDirection: 'row', gap: 9, paddingHorizontal: 15, paddingVertical: 13, borderRadius: radius.md, marginBottom: 15 },
  icon: { paddingTop: 1 },
  text: { flex: 1, fontSize: 12, lineHeight: 19 },
});
